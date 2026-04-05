"""Data model for a citizen issue report."""

from dataclasses import dataclass, asdict

@dataclass
class Report:
    issue_type: str
    description: str
    location: dict
    reporter: str
    status: str = "new"
    sentiment: str = "general"

    def to_dict(self):
        return asdict(self)
