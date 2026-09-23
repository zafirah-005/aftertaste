from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

SymptomType = Literal["diarrhoea", "vomiting", "fever", "other"]
AlertStatus = Literal["needs_checking", "confirmed", "false_alarm", "investigating"]


class ReportIn(BaseModel):
    village_id: int
    symptom_type: SymptomType
    cases: int = Field(gt=0, le=10000)
    report_date: date


class ReportOut(BaseModel):
    id: int
    village_id: int
    symptom_type: str
    cases: int
    report_date: str
    created_at: str


class VillageOut(BaseModel):
    id: int
    name: str
    pincode: str
    lat: float
    lng: float
    today_cases: int
    baseline_mean: float
    z_score: float
    status: str
    confidence: float
    total_cases: int


class HistoryPoint(BaseModel):
    date: str
    cases: int
    expected: float


class AlertOut(BaseModel):
    id: int
    village_id: int
    village_name: str
    alert_type: str
    reason: str
    confidence: float
    status: str
    alert_date: str
    created_at: str
    ai_explanation: str | None = None


class AlertStatusUpdate(BaseModel):
    status: AlertStatus
