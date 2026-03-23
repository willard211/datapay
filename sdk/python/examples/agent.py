from datapay import DataPayClient
import json

def run_agent():
    print("🤖 [MarketAgent] 正在初始化 Python 版 AI 市场调研 Agent...")
    client = DataPayClient(wallet_address="python-researcher-01")

    # 目标资产地址 (之前发布的金融行情数据)
    # 注意：这里的 ID 可能在不同运行中变化，我们假设一个示例场景
    BASE_URL = "http://localhost:4020/api/v1/data"
    
    print("\n--- 任务 1: 获取资产货架 ---")
    discovery_res = client.query("http://localhost:4020/.well-known/x402-assets.json")
    print(f"发现 {len(discovery_res)} 个可用资产。")

    # 寻找我们刚刚发布的资产
    target_asset = next((a for a in discovery_res if "金融" in a['name']), None)
    
    if target_asset:
        asset_url = f"{BASE_URL}/{target_asset['id']}"
        print(f"\n--- 任务 2: 调用收费数据接口 [{target_asset['name']}] ---")
        try:
            data = client.query(asset_url)
            print("收到数据结果:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
        except Exception as e:
            print(f"❌ 调用失败: {e}")
    else:
        print("未找到目标金融资产。")

if __name__ == "__main__":
    run_agent()
