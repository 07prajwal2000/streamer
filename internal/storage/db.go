package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

type ConnectionProfile struct {
	ID              string     `json:"id"`
	Protocol        string     `json:"protocol"` // "nats" or "kafka" (defaults to "nats")
	Name            string     `json:"name"`
	URL             string     `json:"url"`      // NATS server URL(s) or Kafka bootstrap brokers
	AuthType        string     `json:"authType"` // nats: none, userpass, token, nkey, credentials, tls | kafka: none, userpass, scram256, scram512, tls
	Username        string     `json:"username,omitempty"`
	Password        string     `json:"password,omitempty"`
	Token           string     `json:"token,omitempty"`
	NKeySeed        string     `json:"nkeySeed,omitempty"`
	CredsFilePath   string     `json:"credsFilePath,omitempty"`
	TLSCAFile       string     `json:"tlsCAFile,omitempty"`
	TLSCertFile     string     `json:"tlsCertFile,omitempty"`
	TLSKeyFile      string     `json:"tlsKeyFile,omitempty"`
	TLSInsecure     bool       `json:"tlsInsecure"`
	TLSSNI          string     `json:"tlsSNI,omitempty"`
	ClientName      string     `json:"clientName"`
	AWSRegion       string     `json:"awsRegion,omitempty"`
	AWSProfile      string     `json:"awsProfile,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
	LastConnectedAt *time.Time `json:"lastConnectedAt,omitempty"`
}

type Storage struct {
	db *sql.DB
}

func NewStorage() (*Storage, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = "."
	}

	appDir := filepath.Join(configDir, "streamer")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}

	dbPath := filepath.Join(appDir, "streamer.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	s := &Storage{db: db}
	if err := s.initSchema(); err != nil {
		db.Close()
		return nil, err
	}

	return s, nil
}

func (s *Storage) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

func (s *Storage) initSchema() error {
	query := `
	CREATE TABLE IF NOT EXISTS connections (
		id TEXT PRIMARY KEY,
		protocol TEXT DEFAULT 'nats',
		name TEXT NOT NULL,
		url TEXT NOT NULL,
		auth_type TEXT NOT NULL,
		username TEXT,
		password TEXT,
		token TEXT,
		nkey_seed TEXT,
		creds_file_path TEXT,
		tls_ca_file TEXT,
		tls_cert_file TEXT,
		tls_key_file TEXT,
		tls_insecure INTEGER DEFAULT 0,
		tls_sni TEXT,
		client_name TEXT DEFAULT 'Streamer',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		last_connected_at DATETIME
	);

	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);
	`
	if _, err := s.db.Exec(query); err != nil {
		return err
	}

	// Idempotent column migrations for existing databases
	_, _ = s.db.Exec("ALTER TABLE connections ADD COLUMN protocol TEXT DEFAULT 'nats';")
	_, _ = s.db.Exec("ALTER TABLE connections ADD COLUMN tls_sni TEXT;")
	_, _ = s.db.Exec("ALTER TABLE connections ADD COLUMN aws_region TEXT;")
	_, _ = s.db.Exec("ALTER TABLE connections ADD COLUMN aws_profile TEXT;")

	return nil
}

func (s *Storage) GetSetting(key string, defaultValue string) string {
	var val string
	err := s.db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&val)
	if err != nil {
		return defaultValue
	}
	return val
}

func (s *Storage) SetSetting(key string, value string) error {
	_, err := s.db.Exec("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value)
	return err
}

func (s *Storage) GetAllConnections() ([]ConnectionProfile, error) {
	rows, err := s.db.Query(`
		SELECT id, COALESCE(protocol, 'nats'), name, url, auth_type, username, password, token, nkey_seed,
		       creds_file_path, tls_ca_file, tls_cert_file, tls_key_file,
		       tls_insecure, COALESCE(tls_sni, ''), client_name,
		       COALESCE(aws_region, ''), COALESCE(aws_profile, ''),
		       created_at, updated_at, last_connected_at
		FROM connections
		ORDER BY updated_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ConnectionProfile
	for rows.Next() {
		var p ConnectionProfile
		var insecure int
		var username, password, token, nkeySeed, credsFile sql.NullString
		var tlsCA, tlsCert, tlsKey sql.NullString
		var lastConnected sql.NullTime

		err := rows.Scan(
			&p.ID, &p.Protocol, &p.Name, &p.URL, &p.AuthType,
			&username, &password, &token, &nkeySeed,
			&credsFile, &tlsCA, &tlsCert, &tlsKey,
			&insecure, &p.TLSSNI, &p.ClientName,
			&p.AWSRegion, &p.AWSProfile,
			&p.CreatedAt, &p.UpdatedAt, &lastConnected,
		)
		if err != nil {
			return nil, err
		}

		if p.Protocol == "" {
			p.Protocol = "nats"
		}
		p.Username = username.String
		p.Password = password.String
		p.Token = token.String
		p.NKeySeed = nkeySeed.String
		p.CredsFilePath = credsFile.String
		p.TLSCAFile = tlsCA.String
		p.TLSCertFile = tlsCert.String
		p.TLSKeyFile = tlsKey.String
		p.TLSInsecure = insecure == 1
		if lastConnected.Valid {
			p.LastConnectedAt = &lastConnected.Time
		}

		list = append(list, p)
	}

	return list, nil
}

func (s *Storage) SaveConnection(p ConnectionProfile) error {
	if p.Protocol == "" {
		p.Protocol = "nats"
	}
	insecure := 0
	if p.TLSInsecure {
		insecure = 1
	}

	query := `
	INSERT INTO connections (
		id, protocol, name, url, auth_type, username, password, token, nkey_seed,
		creds_file_path, tls_ca_file, tls_cert_file, tls_key_file,
		tls_insecure, tls_sni, client_name, aws_region, aws_profile, created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		protocol = excluded.protocol,
		name = excluded.name,
		url = excluded.url,
		auth_type = excluded.auth_type,
		username = excluded.username,
		password = excluded.password,
		token = excluded.token,
		nkey_seed = excluded.nkey_seed,
		creds_file_path = excluded.creds_file_path,
		tls_ca_file = excluded.tls_ca_file,
		tls_cert_file = excluded.tls_cert_file,
		tls_key_file = excluded.tls_key_file,
		tls_insecure = excluded.tls_insecure,
		tls_sni = excluded.tls_sni,
		client_name = excluded.client_name,
		aws_region = excluded.aws_region,
		aws_profile = excluded.aws_profile,
		updated_at = excluded.updated_at
	`
	now := time.Now().UTC()
	if p.CreatedAt.IsZero() {
		p.CreatedAt = now
	}
	p.UpdatedAt = now

	_, err := s.db.Exec(query,
		p.ID, p.Protocol, p.Name, p.URL, p.AuthType,
		p.Username, p.Password, p.Token, p.NKeySeed,
		p.CredsFilePath, p.TLSCAFile, p.TLSCertFile, p.TLSKeyFile,
		insecure, p.TLSSNI, p.ClientName, p.AWSRegion, p.AWSProfile, p.CreatedAt, p.UpdatedAt,
	)
	return err
}

func (s *Storage) DeleteConnection(id string) error {
	_, err := s.db.Exec("DELETE FROM connections WHERE id = ?", id)
	return err
}

func (s *Storage) UpdateLastConnected(id string) error {
	now := time.Now().UTC()
	_, err := s.db.Exec("UPDATE connections SET last_connected_at = ? WHERE id = ?", now, id)
	return err
}
