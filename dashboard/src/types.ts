export interface Asset {
  id: string;
  name: string;
  price: number;
  currency: string;
  totalQueries: number;
  totalRevenue: number;
  sourceType: string;
  description: string;
  tags: string[];
}

export interface ServerStatus {
  running: boolean;
  port: number;
  assets: Asset[];
  totalQueries: number;
  totalRevenue: number;
  uptime: number;
}
