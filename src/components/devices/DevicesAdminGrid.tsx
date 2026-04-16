'use client';

import * as React from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, Button, Stack, Switch, FormControlLabel } from '@mui/material';
import { DataGrid, GridColDef, GridToolbarContainer, GridToolbarQuickFilter } from '@mui/x-data-grid';
const theme = createTheme({
  palette: { mode: 'light' },
});

export interface DeviceRow {
  id: string;
  deviceId: string;
  deviceEUI: string;
  name: string;
  description?: string;
  decoder: string;
  manufacturer?: string;
  model?: string;
  location?: string;
  tags: string[];
  active: boolean;
  archived: boolean;
  lastActivity?: string;
  createdAt: string;
  updatedAt: string;
  lineMetrics?: {
    enabled: boolean;
    clientId?: string;
    clientSecret?: string;
    projectId?: string;
    dataPoints?: Record<string, string>;
  };
}

function CustomToolbar() {
  return (
    <GridToolbarContainer sx={{ p: 1, gap: 1, flexWrap: 'wrap' }}>
      <GridToolbarQuickFilter />
    </GridToolbarContainer>
  );
}

interface DevicesAdminGridProps {
  onEdit?: (row: DeviceRow) => void;
}

export function DevicesAdminGrid({ onEdit }: DevicesAdminGridProps) {
  const [rows, setRows] = React.useState<DeviceRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [includeArchived, setIncludeArchived] = React.useState(false);
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = includeArchived ? '?includeArchived=true' : '';
      const res = await fetch(`/api/devices${q}`);
      const data = await res.json();
      if (data.success) {
        setRows(
          (data.data as DeviceRow[]).map((d) => ({
            ...d,
            id: d.deviceId,
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ devices: rows }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `devices-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text) as { devices?: unknown[] };
    const devices = Array.isArray(parsed.devices) ? parsed.devices : [];
    await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ import: true, devices }),
    });
    await load();
    e.target.value = '';
  };

  const columns: GridColDef<DeviceRow>[] = React.useMemo(
    () => [
    { field: 'deviceEUI', headerName: 'DevEUI', width: 150 },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 140 },
    { field: 'decoder', width: 130 },
    { field: 'manufacturer', width: 110 },
    { field: 'model', width: 110 },
    {
      field: 'tags',
      headerName: 'Tags',
      width: 160,
      valueGetter: (_v, row) => (row.tags || []).join(', '),
    },
    { field: 'archived', type: 'boolean', width: 90 },
    { field: 'updatedAt', headerName: 'Updated', width: 180 },
    {
      field: 'actions',
      headerName: '',
      width: 100,
      sortable: false,
      filterable: false,
      renderCell: (params) =>
        onEdit ? (
          <Button size="small" onClick={() => onEdit(params.row)}>
            Edit
          </Button>
        ) : null,
    },
  ],
    [onEdit]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
          <FormControlLabel
            control={
              <Switch checked={includeArchived} onChange={(_, v) => setIncludeArchived(v)} />
            }
            label="Show archived"
          />
          <Button variant="outlined" onClick={exportJson}>
            Export JSON
          </Button>
          <Button variant="outlined" component="label">
            Import JSON
            <input type="file" accept="application/json" hidden onChange={(e) => void onImportFile(e)} />
          </Button>
          <Button variant="contained" onClick={() => void load()}>
            Refresh
          </Button>
        </Stack>
      </Stack>
      <Box sx={{ height: 480, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          slots={{ toolbar: CustomToolbar }}
          disableRowSelectionOnClick
        />
      </Box>
    </ThemeProvider>
  );
}
