package sqsmanager

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
)

// ExtractQueueName derives the queue name from its URL
func ExtractQueueName(rawQueueURL string) string {
	parsed, err := url.Parse(rawQueueURL)
	if err == nil && parsed.Path != "" {
		parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
		if len(parts) > 0 && parts[len(parts)-1] != "" {
			return parts[len(parts)-1]
		}
	}
	parts := strings.Split(rawQueueURL, "/")
	return parts[len(parts)-1]
}

// ListQueues lists all queues matching an optional prefix, concurrently fetching attributes
func (m *SqsManager) ListQueues(ctx context.Context, prefix string) ([]SQSQueueSummary, error) {
	client, err := m.GetClient()
	if err != nil {
		return nil, err
	}

	input := &sqs.ListQueuesInput{
		MaxResults: aws.Int32(1000),
	}
	if strings.TrimSpace(prefix) != "" {
		input.QueueNamePrefix = aws.String(strings.TrimSpace(prefix))
	}

	out, err := client.ListQueues(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to list SQS queues: %w", err)
	}

	if len(out.QueueUrls) == 0 {
		return []SQSQueueSummary{}, nil
	}

	// Fetch attributes concurrently with bounded workers (up to 10 workers)
	numWorkers := 10
	if len(out.QueueUrls) < numWorkers {
		numWorkers = len(out.QueueUrls)
	}

	type queueJob struct {
		index int
		url   string
	}

	jobs := make(chan queueJob, len(out.QueueUrls))
	results := make([]SQSQueueSummary, len(out.QueueUrls))
	var wg sync.WaitGroup

	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for job := range jobs {
				resolvedURL := m.ResolveQueueURL(job.url)
				summary := m.fetchQueueSummary(ctx, client, resolvedURL)
				results[job.index] = summary
			}
		}()
	}

	for i, qURL := range out.QueueUrls {
		jobs <- queueJob{index: i, url: qURL}
	}
	close(jobs)
	wg.Wait()

	// Heuristic: identify dead-letter queues by checking if any other queue targets them
	dlqTargets := make(map[string]bool)
	for _, q := range results {
		if q.HasRedrivePolicy && q.DeadLetterTargetARN != "" {
			dlqTargets[q.DeadLetterTargetARN] = true
		}
	}

	for i := range results {
		if dlqTargets[results[i].QueueARN] {
			results[i].IsDeadLetterQueue = true
		}
	}

	// Sort alphabetically by queue name
	sort.Slice(results, func(i, j int) bool {
		return strings.ToLower(results[i].QueueName) < strings.ToLower(results[j].QueueName)
	})

	return results, nil
}

// fetchQueueSummary retrieves queue attributes and maps them to SQSQueueSummary
func (m *SqsManager) fetchQueueSummary(ctx context.Context, client *sqs.Client, queueURL string) SQSQueueSummary {
	queueName := ExtractQueueName(queueURL)
	isFIFO := strings.HasSuffix(queueName, ".fifo")

	summary := SQSQueueSummary{
		QueueURL:             queueURL,
		QueueName:            queueName,
		IsFIFO:               isFIFO,
		ServerSideEncryption: "None",
	}

	attrOut, err := client.GetQueueAttributes(ctx, &sqs.GetQueueAttributesInput{
		QueueUrl: aws.String(queueURL),
		AttributeNames: []types.QueueAttributeName{
			types.QueueAttributeNameAll,
		},
	})
	if err != nil {
		return summary
	}

	attrs := attrOut.Attributes
	summary.QueueARN = attrs[string(types.QueueAttributeNameQueueArn)]
	summary.ApproximateNumberOfMessages, _ = strconv.ParseInt(attrs[string(types.QueueAttributeNameApproximateNumberOfMessages)], 10, 64)
	summary.ApproximateNumberOfNotVisible, _ = strconv.ParseInt(attrs[string(types.QueueAttributeNameApproximateNumberOfMessagesNotVisible)], 10, 64)
	summary.ApproximateNumberOfDelayed, _ = strconv.ParseInt(attrs[string(types.QueueAttributeNameApproximateNumberOfMessagesDelayed)], 10, 64)
	summary.VisibilityTimeoutSeconds, _ = strconv.Atoi(attrs[string(types.QueueAttributeNameVisibilityTimeout)])
	summary.MessageRetentionSeconds, _ = strconv.Atoi(attrs[string(types.QueueAttributeNameMessageRetentionPeriod)])
	summary.DelaySeconds, _ = strconv.Atoi(attrs[string(types.QueueAttributeNameDelaySeconds)])
	summary.CreatedTimestamp, _ = strconv.ParseInt(attrs[string(types.QueueAttributeNameCreatedTimestamp)], 10, 64)
	summary.LastModifiedTimestamp, _ = strconv.ParseInt(attrs[string(types.QueueAttributeNameLastModifiedTimestamp)], 10, 64)

	if attrs[string(types.QueueAttributeNameFifoQueue)] == "true" {
		summary.IsFIFO = true
	}

	// Redrive policy
	if redriveJSON, ok := attrs[string(types.QueueAttributeNameRedrivePolicy)]; ok && redriveJSON != "" {
		var rCfg RedrivePolicyConfig
		if err := json.Unmarshal([]byte(redriveJSON), &rCfg); err == nil {
			summary.HasRedrivePolicy = true
			summary.DeadLetterTargetARN = rCfg.DeadLetterTargetArn
			summary.MaxReceiveCount = rCfg.MaxReceiveCount
		}
	}

	// Server-Side Encryption
	if attrs[string(types.QueueAttributeNameKmsMasterKeyId)] != "" {
		summary.ServerSideEncryption = "SSE-KMS"
	} else if attrs[string(types.QueueAttributeNameSqsManagedSseEnabled)] == "true" {
		summary.ServerSideEncryption = "SSE-SQS"
	}

	return summary
}

// GetQueueDetails retrieves complete queue attributes, tags, and DLQ source queues
func (m *SqsManager) GetQueueDetails(ctx context.Context, queueURL string) (*SQSQueueDetail, error) {
	client, err := m.GetClient()
	if err != nil {
		return nil, err
	}

	resolvedURL := m.ResolveQueueURL(queueURL)
	summary := m.fetchQueueSummary(ctx, client, resolvedURL)

	detail := &SQSQueueDetail{
		SQSQueueSummary: summary,
		Tags:            make(map[string]string),
	}

	attrOut, err := client.GetQueueAttributes(ctx, &sqs.GetQueueAttributesInput{
		QueueUrl: aws.String(resolvedURL),
		AttributeNames: []types.QueueAttributeName{
			types.QueueAttributeNameAll,
		},
	})
	if err == nil {
		attrs := attrOut.Attributes
		detail.Policy = attrs[string(types.QueueAttributeNamePolicy)]
		detail.RedrivePolicy = attrs[string(types.QueueAttributeNameRedrivePolicy)]
		detail.RedriveAllowPolicy = attrs[string(types.QueueAttributeNameRedriveAllowPolicy)]
		detail.MaximumMessageSize, _ = strconv.Atoi(attrs[string(types.QueueAttributeNameMaximumMessageSize)])
		detail.ReceiveMessageWaitTimeSeconds, _ = strconv.Atoi(attrs[string(types.QueueAttributeNameReceiveMessageWaitTimeSeconds)])
		detail.DeduplicationScope = attrs[string(types.QueueAttributeNameDeduplicationScope)]
		detail.FifoThroughputLimit = attrs[string(types.QueueAttributeNameFifoThroughputLimit)]
		detail.ContentBasedDeduplication = attrs[string(types.QueueAttributeNameContentBasedDeduplication)] == "true"
		detail.KmsMasterKeyID = attrs[string(types.QueueAttributeNameKmsMasterKeyId)]
		detail.KmsDataKeyReusePeriodSeconds, _ = strconv.Atoi(attrs[string(types.QueueAttributeNameKmsDataKeyReusePeriodSeconds)])
		detail.SqsManagedSseEnabled = attrs[string(types.QueueAttributeNameSqsManagedSseEnabled)] == "true"
	}

	// Fetch Tags
	tagsOut, err := client.ListQueueTags(ctx, &sqs.ListQueueTagsInput{
		QueueUrl: aws.String(resolvedURL),
	})
	if err == nil && tagsOut.Tags != nil {
		detail.Tags = tagsOut.Tags
	}

	// Fetch Dead Letter Source Queues (if any)
	dlSourcesOut, err := client.ListDeadLetterSourceQueues(ctx, &sqs.ListDeadLetterSourceQueuesInput{
		QueueUrl: aws.String(resolvedURL),
	})
	if err == nil && len(dlSourcesOut.QueueUrls) > 0 {
		detail.IsDeadLetterQueue = true
		for _, rawSrcURL := range dlSourcesOut.QueueUrls {
			detail.DeadLetterSourceQueues = append(detail.DeadLetterSourceQueues, m.ResolveQueueURL(rawSrcURL))
		}
	}

	return detail, nil
}

// CreateQueue creates an SQS queue with specified attributes, encryption, DLQ policy, and tags
func (m *SqsManager) CreateQueue(ctx context.Context, params CreateQueueParams) (*SQSQueueSummary, error) {
	client, err := m.GetClient()
	if err != nil {
		return nil, err
	}

	queueName := strings.TrimSpace(params.QueueName)
	if queueName == "" {
		return nil, fmt.Errorf("queue name cannot be empty")
	}

	// Handle FIFO naming constraints
	if params.IsFIFO {
		if !strings.HasSuffix(queueName, ".fifo") {
			queueName += ".fifo"
		}
	} else if strings.HasSuffix(queueName, ".fifo") {
		params.IsFIFO = true
	}

	attrs := make(map[string]string)

	// Timing and sizing defaults & bounds
	visibilityTimeout := params.VisibilityTimeout
	if visibilityTimeout <= 0 {
		visibilityTimeout = 30
	}
	attrs[string(types.QueueAttributeNameVisibilityTimeout)] = strconv.Itoa(int(visibilityTimeout))

	retention := params.MessageRetentionPeriod
	if retention <= 0 {
		retention = 345600 // 4 days default
	}
	attrs[string(types.QueueAttributeNameMessageRetentionPeriod)] = strconv.Itoa(int(retention))

	if params.DelaySeconds > 0 {
		attrs[string(types.QueueAttributeNameDelaySeconds)] = strconv.Itoa(int(params.DelaySeconds))
	}

	maxMsgSize := params.MaximumMessageSize
	if maxMsgSize <= 0 {
		maxMsgSize = 262144 // 256 KB default
	}
	attrs[string(types.QueueAttributeNameMaximumMessageSize)] = strconv.Itoa(int(maxMsgSize))

	if params.ReceiveMessageWaitTimeSeconds > 0 {
		attrs[string(types.QueueAttributeNameReceiveMessageWaitTimeSeconds)] = strconv.Itoa(int(params.ReceiveMessageWaitTimeSeconds))
	}

	// FIFO Attributes
	if params.IsFIFO {
		attrs[string(types.QueueAttributeNameFifoQueue)] = "true"
		if params.ContentBasedDeduplication {
			attrs[string(types.QueueAttributeNameContentBasedDeduplication)] = "true"
		}
		if params.DeduplicationScope != "" {
			attrs[string(types.QueueAttributeNameDeduplicationScope)] = params.DeduplicationScope
		}
		if params.FifoThroughputLimit != "" {
			attrs[string(types.QueueAttributeNameFifoThroughputLimit)] = params.FifoThroughputLimit
		}
	}

	// Dead Letter Queue Redrive Policy
	if params.EnableDLQ && strings.TrimSpace(params.DeadLetterTargetARN) != "" {
		maxReceive := params.MaxReceiveCount
		if maxReceive <= 0 {
			maxReceive = 3
		}
		redriveCfg := RedrivePolicyConfig{
			DeadLetterTargetArn: strings.TrimSpace(params.DeadLetterTargetARN),
			MaxReceiveCount:     maxReceive,
		}
		redriveBytes, err := json.Marshal(redriveCfg)
		if err != nil {
			return nil, fmt.Errorf("failed to encode redrive policy: %w", err)
		}
		attrs[string(types.QueueAttributeNameRedrivePolicy)] = string(redriveBytes)
	}

	// Encryption
	switch params.ServerSideEncryption {
	case "SSE-SQS":
		attrs[string(types.QueueAttributeNameSqsManagedSseEnabled)] = "true"
	case "SSE-KMS":
		kmsKey := strings.TrimSpace(params.KmsMasterKeyID)
		if kmsKey == "" {
			kmsKey = "alias/aws/sqs"
		}
		attrs[string(types.QueueAttributeNameKmsMasterKeyId)] = kmsKey
	}

	input := &sqs.CreateQueueInput{
		QueueName:  aws.String(queueName),
		Attributes: attrs,
	}

	if len(params.Tags) > 0 {
		input.Tags = params.Tags
	}

	out, err := client.CreateQueue(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to create queue '%s': %w", queueName, err)
	}

	resolvedURL := m.ResolveQueueURL(*out.QueueUrl)
	summary := m.fetchQueueSummary(ctx, client, resolvedURL)
	return &summary, nil
}

// DeleteQueue deletes an SQS queue by URL
func (m *SqsManager) DeleteQueue(ctx context.Context, queueURL string) error {
	client, err := m.GetClient()
	if err != nil {
		return err
	}

	resolvedURL := m.ResolveQueueURL(queueURL)
	_, err = client.DeleteQueue(ctx, &sqs.DeleteQueueInput{
		QueueUrl: aws.String(resolvedURL),
	})
	if err != nil {
		return fmt.Errorf("failed to delete queue: %w", err)
	}
	return nil
}

// PurgeQueue deletes all messages in an SQS queue, handling AWS 60-second cooldown rate limits
func (m *SqsManager) PurgeQueue(ctx context.Context, queueURL string) error {
	client, err := m.GetClient()
	if err != nil {
		return err
	}

	resolvedURL := m.ResolveQueueURL(queueURL)
	_, err = client.PurgeQueue(ctx, &sqs.PurgeQueueInput{
		QueueUrl: aws.String(resolvedURL),
	})
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "PurgeQueueInProgress") || strings.Contains(strings.ToLower(errMsg), "cooldown") || strings.Contains(strings.ToLower(errMsg), "wait 60 seconds") {
			return fmt.Errorf("Purge in progress: SQS enforces a 60-second cooldown between purges for this queue. Please wait before trying again.")
		}
		return fmt.Errorf("failed to purge queue: %w", err)
	}
	return nil
}

// UpdateQueueAttributes updates one or more queue attributes
func (m *SqsManager) UpdateQueueAttributes(ctx context.Context, queueURL string, attributes map[string]string) error {
	client, err := m.GetClient()
	if err != nil {
		return err
	}

	if len(attributes) == 0 {
		return nil
	}

	resolvedURL := m.ResolveQueueURL(queueURL)
	_, err = client.SetQueueAttributes(ctx, &sqs.SetQueueAttributesInput{
		QueueUrl:   aws.String(resolvedURL),
		Attributes: attributes,
	})
	if err != nil {
		return fmt.Errorf("failed to update queue attributes: %w", err)
	}
	return nil
}

// UpdateQueueTags adds new tags and removes specified tag keys
func (m *SqsManager) UpdateQueueTags(ctx context.Context, queueURL string, tags map[string]string, removeKeys []string) error {
	client, err := m.GetClient()
	if err != nil {
		return err
	}

	resolvedURL := m.ResolveQueueURL(queueURL)

	if len(tags) > 0 {
		_, err := client.TagQueue(ctx, &sqs.TagQueueInput{
			QueueUrl: aws.String(resolvedURL),
			Tags:     tags,
		})
		if err != nil {
			return fmt.Errorf("failed to set queue tags: %w", err)
		}
	}

	if len(removeKeys) > 0 {
		_, err := client.UntagQueue(ctx, &sqs.UntagQueueInput{
			QueueUrl: aws.String(resolvedURL),
			TagKeys:  removeKeys,
		})
		if err != nil {
			return fmt.Errorf("failed to remove queue tags: %w", err)
		}
	}

	return nil
}
