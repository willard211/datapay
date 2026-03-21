// ============================================================
// DataPay / wrap402 - Asset Loader
// Loads CSV/JSON data files and infers schema
// ============================================================
import { readFileSync } from 'fs';
import { extname } from 'path';

/** Load a data file and return parsed records + inferred schema */
export function loadAssetData(filePath: string): { data: any[]; schema: Record<string, string> } {
  const ext = extname(filePath).toLowerCase();

  switch (ext) {
    case '.json':
      return loadJson(filePath);
    case '.csv':
      return loadCsv(filePath);
    default:
      throw new Error(`不支持的文件格式: ${ext}（目前支持 .json 和 .csv）`);
  }
}

/** Load and parse JSON file */
function loadJson(filePath: string): { data: any[]; schema: Record<string, string> } {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);

  // If it's an array, use directly; if object with a data field, use that
  let data: any[];
  if (Array.isArray(parsed)) {
    data = parsed;
  } else if (parsed.data && Array.isArray(parsed.data)) {
    data = parsed.data;
  } else {
    // Wrap single object into array
    data = [parsed];
  }

  const schema = inferSchema(data);
  return { data, schema };
}

/** Load and parse CSV file */
function loadCsv(filePath: string): { data: any[]; schema: Record<string, string> } {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV 文件至少需要包含表头行和一行数据');
  }

  const headers = parseCsvLine(lines[0]);
  const data: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const record: any = {};
    headers.forEach((header, idx) => {
      const value = values[idx] || '';
      // Try to parse numbers
      const num = Number(value);
      record[header] = !isNaN(num) && value !== '' ? num : value;
    });
    data.push(record);
  }

  const schema = inferSchema(data);
  return { data, schema };
}

/** Simple CSV line parser (handles quoted values) */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/** Infer schema from data records */
function inferSchema(data: any[]): Record<string, string> {
  if (data.length === 0) return {};

  const sample = data[0];
  const schema: Record<string, string> = {};

  for (const [key, value] of Object.entries(sample)) {
    if (typeof value === 'number') {
      schema[key] = Number.isInteger(value) ? 'integer' : 'number';
    } else if (typeof value === 'boolean') {
      schema[key] = 'boolean';
    } else if (typeof value === 'string') {
      // Check if it looks like a date
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        schema[key] = 'date';
      } else {
        schema[key] = 'string';
      }
    } else if (Array.isArray(value)) {
      schema[key] = 'array';
    } else if (typeof value === 'object' && value !== null) {
      schema[key] = 'object';
    } else {
      schema[key] = 'string';
    }
  }

  return schema;
}
