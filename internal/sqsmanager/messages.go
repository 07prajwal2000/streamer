package sqsmanager

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// SendMessage publishes a single message to an SQS queue
func (m *SqsManager) SendMessage(ctx context.Context, params SendSQSMessageParams) (*SendSQSMessageResult, error) {
	client, err := m.GetClient()
	if err != nil {
		return nil, err
	}

	body := params.Body
	if strings.TrimSpace(body) == "" {
		return nil, errors.New("message body cannot be empty")
	}

	resolvedURL := m.ResolveQueueURL(params.QueueURL)
	queueName := ExtractQueueName(resolvedURL)
	isFIFO := strings.HasSuffix(queueName, ".fifo")

	input := &sqs.SendMessageInput{
		QueueUrl:    aws.String(resolvedURL),
		MessageBody: aws.String(body),
	}

	if params.DelaySeconds > 0 && !isFIFO {
		input.DelaySeconds = params.DelaySeconds
	}

	// FIFO Queue constraints
	if isFIFO {
		groupID := strings.TrimSpace(params.MessageGroupID)
		if groupID == "" {
			groupID = "default"
		}
		input.MessageGroupId = aws.String(groupID)

		if strings.TrimSpace(params.MessageDeduplicationID) != "" {
			input.MessageDeduplicationId = aws.String(strings.TrimSpace(params.MessageDeduplicationID))
		}
	}

	// Message Attributes
	if len(params.MessageAttributes) > 0 {
		attrs := make(map[string]types.MessageAttributeValue)
		for k, attr := range params.MessageAttributes {
			if strings.TrimSpace(k) == "" {
				continue
			}
			val := types.MessageAttributeValue{
				DataType: aws.String(attr.DataType),
			}
			if strings.EqualFold(attr.DataType, "Binary") {
				if attr.BinaryValue != "" {
					decoded, err := base64.StdEncoding.DecodeString(attr.BinaryValue)
					if err == nil {
						val.BinaryValue = decoded
					} else {
						val.BinaryValue = []byte(attr.BinaryValue)
					}
				}
			} else {
				val.StringValue = aws.String(attr.StringValue)
			}
			attrs[k] = val
		}
		if len(attrs) > 0 {
			input.MessageAttributes = attrs
		}
	}

	out, err := client.SendMessage(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to send SQS message: %w", err)
	}

	return &SendSQSMessageResult{
		MessageID:      aws.ToString(out.MessageId),
		MD5OfBody:      aws.ToString(out.MD5OfMessageBody),
		SequenceNumber: aws.ToString(out.SequenceNumber),
	}, nil
}

// PollMessages fetches messages from an SQS queue supporting Peek Mode and Consumer Mode
func (m *SqsManager) PollMessages(ctx context.Context, params PollSQSMessagesParams) ([]SQSMessage, error) {
	client, err := m.GetClient()
	if err != nil {
		return nil, err
	}

	resolvedURL := m.ResolveQueueURL(params.QueueURL)
	if strings.TrimSpace(resolvedURL) == "" {
		return nil, errors.New("queue URL is required")
	}

	maxMsg := params.MaxMessages
	if maxMsg <= 0 {
		maxMsg = 10
	} else if maxMsg > 10 {
		maxMsg = 10
	}

	waitTime := params.WaitTimeSeconds
	if waitTime < 0 {
		waitTime = 0
	} else if waitTime > 20 {
		waitTime = 20
	}

	visibilityTimeout := params.VisibilityTimeout
	isPeek := strings.EqualFold(params.Mode, "peek")
	if isPeek {
		visibilityTimeout = 0
	} else if visibilityTimeout <= 0 {
		visibilityTimeout = 30
	}

	input := &sqs.ReceiveMessageInput{
		QueueUrl:            aws.String(resolvedURL),
		MaxNumberOfMessages: maxMsg,
		WaitTimeSeconds:     waitTime,
		VisibilityTimeout:   visibilityTimeout,
		AttributeNames: []types.QueueAttributeName{
			types.QueueAttributeNameAll,
		},
		MessageAttributeNames: []string{
			"All",
		},
	}

	out, err := client.ReceiveMessage(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to receive messages: %w", err)
	}

	queueName := ExtractQueueName(resolvedURL)
	var results []SQSMessage

	for _, msg := range out.Messages {
		sqsMsg := SQSMessage{
			MessageID:         aws.ToString(msg.MessageId),
			ReceiptHandle:     aws.ToString(msg.ReceiptHandle),
			MD5OfBody:         aws.ToString(msg.MD5OfBody),
			Body:              aws.ToString(msg.Body),
			QueueURL:          resolvedURL,
			QueueName:         queueName,
			Attributes:        msg.Attributes,
			MessageAttributes: make(map[string]SQSMessageAttribute),
		}

		// Parse system attributes
		if sentTsStr, ok := msg.Attributes[string(types.MessageSystemAttributeNameSentTimestamp)]; ok {
			sqsMsg.SentTimestamp, _ = strconv.ParseInt(sentTsStr, 10, 64)
		}
		if firstRecTsStr, ok := msg.Attributes[string(types.MessageSystemAttributeNameApproximateFirstReceiveTimestamp)]; ok {
			sqsMsg.FirstReceiveTimestamp, _ = strconv.ParseInt(firstRecTsStr, 10, 64)
		}
		if recCountStr, ok := msg.Attributes[string(types.MessageSystemAttributeNameApproximateReceiveCount)]; ok {
			sqsMsg.ReceiveCount, _ = strconv.Atoi(recCountStr)
		}
		if groupID, ok := msg.Attributes[string(types.MessageSystemAttributeNameMessageGroupId)]; ok {
			sqsMsg.MessageGroupID = groupID
		}
		if dedupID, ok := msg.Attributes[string(types.MessageSystemAttributeNameMessageDeduplicationId)]; ok {
			sqsMsg.MessageDeduplicationID = dedupID
		}
		if seqNum, ok := msg.Attributes[string(types.MessageSystemAttributeNameSequenceNumber)]; ok {
			sqsMsg.SequenceNumber = seqNum
		}

		// Map user message attributes
		for k, attr := range msg.MessageAttributes {
			item := SQSMessageAttribute{
				DataType: aws.ToString(attr.DataType),
			}
			if attr.StringValue != nil {
				item.StringValue = *attr.StringValue
			}
			if len(attr.BinaryValue) > 0 {
				item.BinaryValue = base64.StdEncoding.EncodeToString(attr.BinaryValue)
			}
			sqsMsg.MessageAttributes[k] = item
		}

		// Peek Mode: reset visibility timeout to 0 immediately so it is untouched for consumers
		if isPeek && msg.ReceiptHandle != nil {
			_, _ = client.ChangeMessageVisibility(ctx, &sqs.ChangeMessageVisibilityInput{
				QueueUrl:          aws.String(resolvedURL),
				ReceiptHandle:     msg.ReceiptHandle,
				VisibilityTimeout: 0,
			})
		} else if !isPeek && params.AutoDelete && msg.ReceiptHandle != nil {
			// Auto-acknowledge / delete on receipt in consumer mode
			_, _ = client.DeleteMessage(ctx, &sqs.DeleteMessageInput{
				QueueUrl:      aws.String(resolvedURL),
				ReceiptHandle: msg.ReceiptHandle,
			})
		}

		results = append(results, sqsMsg)
	}

	return results, nil
}

// DeleteMessage deletes a single message from an SQS queue
func (m *SqsManager) DeleteMessage(ctx context.Context, queueURL string, receiptHandle string) error {
	client, err := m.GetClient()
	if err != nil {
		return err
	}

	if strings.TrimSpace(receiptHandle) == "" {
		return errors.New("receipt handle cannot be empty")
	}

	resolvedURL := m.ResolveQueueURL(queueURL)
	_, err = client.DeleteMessage(ctx, &sqs.DeleteMessageInput{
		QueueUrl:      aws.String(resolvedURL),
		ReceiptHandle: aws.String(receiptHandle),
	})
	if err != nil {
		return fmt.Errorf("failed to delete message: %w", err)
	}
	return nil
}

// ChangeMessageVisibility updates the visibility timeout of a received message
func (m *SqsManager) ChangeMessageVisibility(ctx context.Context, queueURL string, receiptHandle string, visibilityTimeout int32) error {
	client, err := m.GetClient()
	if err != nil {
		return err
	}

	if strings.TrimSpace(receiptHandle) == "" {
		return errors.New("receipt handle cannot be empty")
	}

	resolvedURL := m.ResolveQueueURL(queueURL)
	_, err = client.ChangeMessageVisibility(ctx, &sqs.ChangeMessageVisibilityInput{
		QueueUrl:          aws.String(resolvedURL),
		ReceiptHandle:     aws.String(receiptHandle),
		VisibilityTimeout: visibilityTimeout,
	})
	if err != nil {
		return fmt.Errorf("failed to change message visibility: %w", err)
	}
	return nil
}

// StartSQSLivePoll begins background real-time message consumption and emits events to Wails
func (m *SqsManager) StartSQSLivePoll(params PollSQSMessagesParams) error {
	_, err := m.GetClient()
	if err != nil {
		return err
	}

	if strings.TrimSpace(params.QueueURL) == "" {
		return errors.New("queue URL is required")
	}

	m.StopSQSLivePoll()

	pollCtx, cancel := context.WithCancel(context.Background())

	m.pollMu.Lock()
	m.pollCancel = cancel
	m.pollMu.Unlock()

	go m.livePollLoop(pollCtx, params)

	return nil
}

// StopSQSLivePoll stops any active live polling loop
func (m *SqsManager) StopSQSLivePoll() error {
	m.pollMu.Lock()
	defer m.pollMu.Unlock()

	if m.pollCancel != nil {
		m.pollCancel()
		m.pollCancel = nil
	}
	return nil
}

func (m *SqsManager) livePollLoop(ctx context.Context, params PollSQSMessagesParams) {
	// Set continuous long-polling wait time (e.g. 5-10s)
	pollParams := params
	if pollParams.WaitTimeSeconds <= 0 {
		pollParams.WaitTimeSeconds = 5
	}
	if pollParams.MaxMessages <= 0 {
		pollParams.MaxMessages = 10
	}

	for {
		if ctx.Err() != nil {
			return
		}

		msgs, err := m.PollMessages(ctx, pollParams)
		if ctx.Err() != nil {
			return
		}

		if err == nil && len(msgs) > 0 {
			for _, msg := range msgs {
				if m.ctx != nil {
					runtime.EventsEmit(m.ctx, "sqs:message", msg)
				}
			}
		} else {
			// Backoff slightly on error or empty response to prevent tight loop
			select {
			case <-ctx.Done():
				return
			case <-time.After(300 * time.Millisecond):
			}
		}
	}
}

// RedriveDLQ moves messages from a Dead-Letter Queue (DLQ) to a target destination queue
func (m *SqsManager) RedriveDLQ(ctx context.Context, params RedriveDLQParams) (*RedriveDLQResult, error) {
	client, err := m.GetClient()
	if err != nil {
		return nil, err
	}

	sourceURL := m.ResolveQueueURL(params.SourceQueueURL)
	targetURL := m.ResolveQueueURL(params.TargetQueueURL)

	if sourceURL == "" || targetURL == "" {
		return nil, errors.New("both source (DLQ) and target queue URLs are required")
	}

	if sourceURL == targetURL {
		return nil, errors.New("source DLQ and destination queue cannot be identical")
	}

	targetName := ExtractQueueName(targetURL)
	isTargetFIFO := strings.HasSuffix(targetName, ".fifo")

	maxToMove := params.MaxMessages
	if maxToMove <= 0 {
		maxToMove = 100 // Default batch limit to prevent runaway loops
	}

	movedCount := 0
	errorCount := 0

	for movedCount < maxToMove {
		if ctx.Err() != nil {
			break
		}

		batchLimit := int32(10)
		remaining := int32(maxToMove - movedCount)
		if remaining < batchLimit {
			batchLimit = remaining
		}

		// Receive messages from DLQ with standard visibility
		recvOut, err := client.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
			QueueUrl:            aws.String(sourceURL),
			MaxNumberOfMessages: batchLimit,
			WaitTimeSeconds:     1,
			VisibilityTimeout:   30,
			AttributeNames: []types.QueueAttributeName{
				types.QueueAttributeNameAll,
			},
			MessageAttributeNames: []string{
				"All",
			},
		})
		if err != nil {
			return nil, fmt.Errorf("failed receiving messages from DLQ: %w", err)
		}

		if len(recvOut.Messages) == 0 {
			// No more messages available in DLQ
			break
		}

		for _, msg := range recvOut.Messages {
			sendInput := &sqs.SendMessageInput{
				QueueUrl:          aws.String(targetURL),
				MessageBody:       msg.Body,
				MessageAttributes: msg.MessageAttributes,
			}

			if isTargetFIFO {
				groupID := msg.Attributes[string(types.MessageSystemAttributeNameMessageGroupId)]
				if groupID == "" {
					groupID = "redrive"
				}
				sendInput.MessageGroupId = aws.String(groupID)
				if dedupID, ok := msg.Attributes[string(types.MessageSystemAttributeNameMessageDeduplicationId)]; ok && dedupID != "" {
					sendInput.MessageDeduplicationId = aws.String(dedupID)
				}
			}

			// Send to destination
			_, sendErr := client.SendMessage(ctx, sendInput)
			if sendErr != nil {
				errorCount++
				// Release message back to DLQ
				_, _ = client.ChangeMessageVisibility(ctx, &sqs.ChangeMessageVisibilityInput{
					QueueUrl:          aws.String(sourceURL),
					ReceiptHandle:     msg.ReceiptHandle,
					VisibilityTimeout: 0,
				})
				continue
			}

			// Delete from DLQ
			_, delErr := client.DeleteMessage(ctx, &sqs.DeleteMessageInput{
				QueueUrl:      aws.String(sourceURL),
				ReceiptHandle: msg.ReceiptHandle,
			})
			if delErr != nil {
				errorCount++
			} else {
				movedCount++
			}
		}
	}

	return &RedriveDLQResult{
		MessagesMoved: movedCount,
		ErrorsCount:   errorCount,
		StatusMessage: fmt.Sprintf("Redrive complete: %d message(s) successfully moved from DLQ to destination.", movedCount),
	}, nil
}
