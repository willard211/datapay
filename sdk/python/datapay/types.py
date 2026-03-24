from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

@dataclass
class PaymentMethod:
    scheme: str
    network: str
    token: str
    amount: str
    pay_to: str
    extra: Dict[str, str] = field(default_factory=dict)

@dataclass
class AssetMetadata:
    id: str
    name: str
    description: str

@dataclass
class PaymentRequired:
    x402_version: str
    accepts: List[PaymentMethod]
    description: str
    asset: AssetMetadata

@dataclass
class PaymentHeader:
    scheme: str
    network: str
    token: str
    amount: str
    payer: str
    signature: str
    timestamp: int

    def to_header(self) -> str:
        """Serialize to x402 semicolon format"""
        return f"{self.scheme};{self.network};{self.token};{self.amount};{self.payer};{self.signature};{self.timestamp}"
