import time
import requests
import json
from typing import Optional, Dict, Any, Union
from .types import PaymentRequired, PaymentHeader, PaymentMethod

class DataPayClient:
    def __init__(self, base_url: str = "http://localhost:4020", wallet_address: str = "demo-user", api_key: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.wallet_address = wallet_address
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}"
        } if api_key else {}

    def ask(self, query: str, address: Optional[str] = None) -> Any:
        """
        Ask the smart gateway with natural language.
        """
        url = f"{self.base_url}/api/v1/agent/ask"
        params = {
            "q": query,
            "address": address or self.wallet_address
        }
        response = requests.get(url, params=params, headers=self.headers)
        if response.status_code != 200:
            raise Exception(f"Agent Ask failed: {response.text}")
        return response.json()

    def get_balance(self, address: Optional[str] = None) -> Any:
        """
        Get account balance.
        """
        url = f"{self.base_url}/api/v1/account/balance"
        params = {
            "address": address or self.wallet_address
        }
        response = requests.get(url, params=params, headers=self.headers)
        if response.status_code != 200:
            raise Exception(f"Get Balance failed: {response.text}")
        return response.json()

    def query(self, url: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """
        Query a DataPay enabled endpoint. Automatically handles 402 Payment Required.
        """
        # 1. Initial request
        response = requests.get(url, params=params)

        if response.status_code == 200:
            return response.json()

        if response.status_code == 402:
            return self._handle_402(url, params, response)
        
        response.raise_for_status()

    def _handle_402(self, url: str, params: Optional[Dict[str, Any]], response: requests.Response) -> Any:
        """
        Handle 402 Payment Required by generating a signature and retrying.
        """
        try:
            data = response.json()
            payment_req = PaymentRequired(
                x402_version=data['x402Version'],
                accepts=data['accepts'],
                description=data['description'],
                asset=data['asset']
            )
        except (ValueError, KeyError) as e:
            raise Exception(f"Invalid 402 response from server: {e}")

        print(f"💰 [DataPay] {payment_req.description}")
        
        # Pick the first preferred payment method
        method = payment_req.accepts[0]
        
        # 2. Simulate Payment & Signature
        # In a real app, this might involve calling a crypto wallet or a private key
        timestamp = int(time.time() * 1000)
        signature = f"sig_py_{self.wallet_address}_{timestamp}" # POC signature
        
        payment = PaymentHeader(
            scheme=method.scheme,
            network=method.network,
            token=method.token,
            amount=method.amount,
            payer=self.wallet_address,
            signature=signature,
            timestamp=timestamp
        )

        # 3. Retry with X-PAYMENT header
        headers = {
            "X-PAYMENT": payment.to_header()
        }
        
        print(f"📤 [DataPay] 正在发送支付凭证: {method.amount} {method.token} via {method.network}")
        
        retry_response = requests.get(url, params=params, headers=headers)
        
        if retry_response.status_code == 200:
            print("✅ [DataPay] 支付验证成功，数据已下发。")
            return retry_response.json()
        
        if retry_response.status_code == 402:
            error_data = retry_response.json()
            reason = error_data.get('reason', '未知原因')
            raise Exception(f"Payment failed: {reason}")

        retry_response.raise_for_status()
