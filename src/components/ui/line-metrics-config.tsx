'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Plus, 
  Trash2, 
  Settings,
  Database,
  Key,
  Globe
} from 'lucide-react';

interface LineMetricsConfigProps {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  projectId: string;
  dataPoints: { [key: string]: string };
  decoder: string;
  onConfigChange: (config: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    projectId: string;
    dataPoints: { [key: string]: string };
  }) => void;
}

// Verfügbare Datenfelder für verschiedene Decoder
const DECODER_FIELDS: { [key: string]: string[] } = {
  'h200': [
    'meterVolume',
    'medium',
    'meterSerialNumber',
    'actualityDuration',
    'meterNoResponse',
    'meterEcoFrameError',
    'meterRollError',
    'brokenPipe',
    'lowBattery',
    'backflow',
    'continuousFlow',
    'noUsage',
    'linkError',
    'keyDate'
  ],
  'integra-topas-sonic': [
    'volume',
    'reverseVolume',
    'waterTemperature',
    'errorCode',
    'battery',
    'meter_id'
  ],
  'harvy2': [
    'vbat',
    'vsys_V',
    'temp',
    'temp_C',
    'c0_rms',
    'c1_rms',
    'c2_rms',
    'c3_rms',
    'c0_mA',
    'c1_mA',
    'c2_mA',
    'c3_mA',
    'in1_ac_curr_A',
    'in2_ac_curr_A',
    'in3_ac_curr_A',
    'in4_ac_curr_A',
    'c0_avg',
    'c1_avg',
    'c2_avg',
    'c3_avg',
    'in1_dc_curr_A',
    'in2_dc_curr_A',
    'in3_dc_curr_A',
    'in4_dc_curr_A',
    'c0_freq',
    'c1_freq',
    'c2_freq',
    'c3_freq',
    'in1_grid_freq_Hz',
    'in2_grid_freq_Hz',
    'in3_grid_freq_Hz',
    'in4_grid_freq_Hz',
    'cosphi_3_0',
    'cosphi_3_1',
    'cosphi_3_2',
    'in4_grid_voltage_VAC',
    'in1_cos',
    'in2_cos',
    'in3_cos',
    'in1_pow_W',
    'in2_pow_W',
    'in3_pow_W',
    'in1_a_pow_VA',
    'in2_a_pow_VA',
    'in3_a_pow_VA',
    'in1_r_pow_VAR',
    'in2_r_pow_VAR',
    'in3_r_pow_VAR'
  ]
};

export function LineMetricsConfig({
  enabled,
  clientId,
  clientSecret,
  projectId,
  dataPoints,
  decoder,
  onConfigChange
}: LineMetricsConfigProps) {
  const [localConfig, setLocalConfig] = useState({
    enabled,
    clientId,
    clientSecret,
    projectId,
    dataPoints: { ...dataPoints }
  });

  const availableFields = DECODER_FIELDS[decoder] || [];

  useEffect(() => {
    setLocalConfig({
      enabled,
      clientId,
      clientSecret,
      projectId,
      dataPoints: { ...dataPoints }
    });
  }, [enabled, clientId, clientSecret, projectId, dataPoints]);

  const handleConfigChange = (field: string, value: boolean | string) => {
    const newConfig = {
      ...localConfig,
      [field]: value
    };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleDataPointChange = (field: string, dataPointId: string) => {
    const newDataPoints = { ...localConfig.dataPoints };
    if (dataPointId) {
      newDataPoints[field] = dataPointId;
    } else {
      delete newDataPoints[field];
    }
    
    const newConfig = {
      ...localConfig,
      dataPoints: newDataPoints
    };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const addDataPointMapping = () => {
    const newConfig = {
      ...localConfig,
      dataPoints: { ...localConfig.dataPoints }
    };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const removeDataPointMapping = (field: string) => {
    const newDataPoints = { ...localConfig.dataPoints };
    delete newDataPoints[field];
    
    const newConfig = {
      ...localConfig,
      dataPoints: newDataPoints
    };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          LineMetrics API Integration
        </CardTitle>
        <CardDescription>
          Konfigurieren Sie die OAuth 2.0 Verbindung zu LineMetrics für automatische Datenübertragung
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Aktivierung */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">LineMetrics Integration aktivieren</Label>
            <p className="text-sm text-muted-foreground">
              Automatische Übertragung der dekodierten Daten an LineMetrics Cloud
            </p>
          </div>
          <Switch
            checked={localConfig.enabled}
            onCheckedChange={(checked: boolean) => handleConfigChange('enabled', checked)}
          />
        </div>

        {localConfig.enabled && (
          <>
            <Separator />
            
            {/* OAuth 2.0 API-Konfiguration */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lineMetricsClientId" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  OAuth Client ID
                </Label>
                <Input
                  id="lineMetricsClientId"
                  type="text"
                  placeholder="LineMetrics OAuth Client ID eingeben"
                  value={localConfig.clientId}
                  onChange={(e) => handleConfigChange('clientId', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lineMetricsClientSecret" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  OAuth Client Secret
                </Label>
                <Input
                  id="lineMetricsClientSecret"
                  type="password"
                  placeholder="LineMetrics OAuth Client Secret eingeben"
                  value={localConfig.clientSecret}
                  onChange={(e) => handleConfigChange('clientSecret', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lineMetricsProjectId" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Asset ID (Custom Key)
                </Label>
                <Input
                  id="lineMetricsProjectId"
                  placeholder="LineMetrics Asset ID eingeben"
                  value={localConfig.projectId}
                  onChange={(e) => handleConfigChange('projectId', e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Data Point Mapping */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Data Point Mapping (Alias)</Label>
                  <p className="text-sm text-muted-foreground">
                    Ordnen Sie Parser-Felder LineMetrics Data Point Aliases zu
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDataPointMapping}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Mapping hinzufügen
                </Button>
              </div>

              {availableFields.length > 0 ? (
                <div className="space-y-3">
                  {availableFields.map((field) => (
                    <div key={field} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-1">
                        <Label className="text-sm font-medium">{field}</Label>
                        <p className="text-xs text-muted-foreground">
                          Parser-Feld: {field}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="LineMetrics Data Point Alias"
                          value={localConfig.dataPoints[field] || ''}
                          onChange={(e) => handleDataPointChange(field, e.target.value)}
                          className="w-48"
                        />
                        {localConfig.dataPoints[field] && (
                          <Badge variant="secondary" className="text-xs">
                            Mapped
                          </Badge>
                        )}
                        {localConfig.dataPoints[field] && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDataPointMapping(field)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Settings className="h-8 w-8 mx-auto mb-2" />
                  <p>Keine verfügbaren Felder für den ausgewählten Parser</p>
                </div>
              )}

              {Object.keys(localConfig.dataPoints).length > 0 && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <Label className="text-sm font-medium mb-2 block">Aktive Mappings:</Label>
                  <div className="space-y-1">
                    {Object.entries(localConfig.dataPoints).map(([field, dataPointId]) => (
                      <div key={field} className="flex items-center justify-between text-sm">
                        <span className="font-mono">{field}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-mono">{dataPointId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
} 