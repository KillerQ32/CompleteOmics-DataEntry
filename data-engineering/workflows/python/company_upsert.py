import os
import math
import uuid
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import Client, create_client


ROOT = Path(__file__).resolve().parents[3]
CSV_PATH = ROOT / "data-engineering" / "reference" / "company-intake-template.csv"


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def clean_value(value):
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    text = str(value).strip()
    return text if text else None


def normalize_company_rows(df: pd.DataFrame) -> list[dict]:
    rows: list[dict] = []

    for record in df.to_dict(orient="records"):
        company_id = clean_value(record.get("id"))
        rows.append(
            {
                "id": company_id or str(uuid.uuid4()),
                "name": clean_value(record.get("name")),
                "address_line_1": clean_value(record.get("address_line_1")),
                "address_line_2": clean_value(record.get("address_line_2")),
                "city": clean_value(record.get("city")),
                "state": clean_value(record.get("state")),
                "postal_code": clean_value(record.get("postal_code")),
                "contact_phone": clean_value(record.get("contact_phone")),
                "contact_email": clean_value(record.get("contact_email")),
            }
        )

    return [row for row in rows if row["name"]]


def upsert_companies(supabase: Client, rows: list[dict], batch_size: int = 500) -> None:
    for start in range(0, len(rows), batch_size):
        chunk = rows[start : start + batch_size]
        if not chunk:
            continue

        response = (
            supabase.table("companies")
            .upsert(chunk, on_conflict="id")
            .execute()
        )
        print(f"Upserted {len(chunk)} company rows")
        print(response)


def main() -> None:
    load_dotenv(ROOT / ".env.local")

    supabase = create_client(
      require_env("NEXT_PUBLIC_SUPABASE_URL"),
      require_env("SUPABASE_SERVICE_ROLE_KEY"),
    )

    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV file not found: {CSV_PATH}")

    dataframe = pd.read_csv(CSV_PATH, dtype=str)
    rows = normalize_company_rows(dataframe)

    if not rows:
        print("No valid company rows found in the intake CSV.")
        return

    upsert_companies(supabase, rows)


if __name__ == "__main__":
    main()
