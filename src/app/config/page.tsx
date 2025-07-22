'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  Database, 
  Globe, 
  Shield, 
  Activity,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';

interface Config {
  server: {
    port: number;
    host: string;
    environment: string;
  };
  database: {
    type: string;
    url: string;
    enabled: boolean;
  };
  webhooks: {
    maxRetries: number;
    timeout: number;
    enabled: boolean;
  };
  security: {
    corsEnabled: boolean;
    rateLimit: number;
    apiKeyRequired: boolean;
  };
  logging: {
    level: string;
    fileEnabled: boolean;
    consoleEnabled: boolean;
  };
}

export default function ConfigPage() {
  const [config, setConfig] = useState<Config>({
    server: {
      port: 3000,
      host: 'localhost',
      environment: 'development'
    },
    database: {
      type: 'sqlite',
      url: './data/webhooks.db',
      enabled: true
    },
    webhooks: {
      maxRetries: 3,
      timeout: 5000,
      enabled: true
    },
    security: {
      corsEnabled: true,
      rateLimit: 100,
      apiKeyRequired: false
    },
    logging: {
      level: 'info',
      fileEnabled: true,
      consoleEnabled: true
    }
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      // Mock config data
      setConfig({
        server: {
          port: 3000,
          host: 'localhost',
          environment: 'development'
        },
        database: {
          type: 'sqlite',
          url: './data/webhooks.db',
          enabled: true
        },
        webhooks: {
          maxRetries: 3,
          timeout: 5000,
          enabled: true
        },
        security: {
          corsEnabled: true,
          rateLimit: 100,
          apiKeyRequired: false
        },
        logging: {
          level: 'info',
          fileEnabled: true,
          consoleEnabled: true
        }
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'Fehler beim Laden der Konfiguration' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMessage({ type: 'success', text: 'Konfiguration erfolgreich gespeichert' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Fehler beim Speichern der Konfiguration' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadConfig();
    setMessage({ type: 'info', text: 'Konfiguration zurückgesetzt' });
  };

  const updateConfig = (section: keyof Config, key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Konfiguration
        </h1>
        <p className="page-subtitle">
          Server-Einstellungen und System-Konfiguration verwalten
        </p>
      </div>

      {/* Message */}
      {message && (
        <Alert className={`mb-6 ${message.type === 'success' ? 'alert-success' : message.type === 'error' ? 'alert-destructive' : 'alert-info'}`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : message.type === 'error' ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Info className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Server Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle>Server Einstellungen</CardTitle>
            </div>
            <CardDescription>
              Grundlegende Server-Konfiguration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={config.server.port}
                  onChange={(e) => updateConfig('server', 'port', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  value={config.server.host}
                  onChange={(e) => updateConfig('server', 'host', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="environment">Umgebung</Label>
              <Select value={config.server.environment} onValueChange={(value) => updateConfig('server', 'environment', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Database Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle>Datenbank</CardTitle>
            </div>
            <CardDescription>
              Datenbank-Verbindung und Einstellungen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dbType">Datenbank Typ</Label>
              <Select value={config.database.type} onValueChange={(value) => updateConfig('database', 'type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sqlite">SQLite</SelectItem>
                  <SelectItem value="postgresql">PostgreSQL</SelectItem>
                  <SelectItem value="mysql">MySQL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dbUrl">Verbindungs-URL</Label>
              <Input
                id="dbUrl"
                value={config.database.url}
                onChange={(e) => updateConfig('database', 'url', e.target.value)}
                placeholder="z.B. ./data/webhooks.db"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="dbEnabled"
                checked={config.database.enabled}
                onChange={(e) => updateConfig('database', 'enabled', e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="dbEnabled">Datenbank aktiviert</Label>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle>Webhook Einstellungen</CardTitle>
            </div>
            <CardDescription>
              Webhook-Verarbeitung und Retry-Logik
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxRetries">Max. Wiederholungen</Label>
                <Input
                  id="maxRetries"
                  type="number"
                  value={config.webhooks.maxRetries}
                  onChange={(e) => updateConfig('webhooks', 'maxRetries', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeout">Timeout (ms)</Label>
                <Input
                  id="timeout"
                  type="number"
                  value={config.webhooks.timeout}
                  onChange={(e) => updateConfig('webhooks', 'timeout', parseInt(e.target.value))}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="webhooksEnabled"
                checked={config.webhooks.enabled}
                onChange={(e) => updateConfig('webhooks', 'enabled', e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="webhooksEnabled">Webhooks aktiviert</Label>
            </div>
          </CardContent>
        </Card>

        {/* Security Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Sicherheit</CardTitle>
            </div>
            <CardDescription>
              Sicherheits- und Zugriffskontrollen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rateLimit">Rate Limit (req/min)</Label>
              <Input
                id="rateLimit"
                type="number"
                value={config.security.rateLimit}
                onChange={(e) => updateConfig('security', 'rateLimit', parseInt(e.target.value))}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="corsEnabled"
                checked={config.security.corsEnabled}
                onChange={(e) => updateConfig('security', 'corsEnabled', e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="corsEnabled">CORS aktiviert</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="apiKeyRequired"
                checked={config.security.apiKeyRequired}
                onChange={(e) => updateConfig('security', 'apiKeyRequired', e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="apiKeyRequired">API-Key erforderlich</Label>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logging Configuration */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Logging Einstellungen</CardTitle>
          <CardDescription>
            Log-Level und Ausgabe-Konfiguration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="logLevel">Log Level</Label>
              <Select value={config.logging.level} onValueChange={(value) => updateConfig('logging', 'level', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="fileEnabled"
                checked={config.logging.fileEnabled}
                onChange={(e) => updateConfig('logging', 'fileEnabled', e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="fileEnabled">Datei-Logging</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="consoleEnabled"
                checked={config.logging.consoleEnabled}
                onChange={(e) => updateConfig('logging', 'consoleEnabled', e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="consoleEnabled">Console-Logging</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="mt-8 flex gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <div className="loading-spinner mr-2"></div>
              Speichere...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Konfiguration speichern
            </>
          )}
        </Button>
        <Button variant="outline" onClick={handleReset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Zurücksetzen
        </Button>
      </div>
    </div>
  );
} 