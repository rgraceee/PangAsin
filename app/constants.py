# WHAT: Constant values shared by multiple blueprints and services.
# WHY: Identical reference data lived in several files; keeping one source of
#      truth makes it easy to update and easy to read.

# WHAT: DB columns for the per-age producer counts on a production record.
# WHY: Encoder and admin code sum/validate these five fields in the same order.
AGE_BUCKET_FIELDS = (
    "producers_18_30",
    "producers_31_40",
    "producers_41_50",
    "producers_51_60",
    "producers_61_plus",
)

# WHAT: Weights used to score how complete each record's data is (0..1 per field).
# WHY: The admin Data Quality view and the report generator score records
#      against the same field weights, so they must not drift apart.
QUALITY_WEIGHTS = {
    "production_volume": 0.20,
    "num_salt_beds": 0.10,
    "area_per_salt_bed": 0.10,
    "registered_producers": 0.15,
    "male_producers": 0.10,
    "female_producers": 0.10,
    "record_date": 0.05,
    "production_method": 0.05,
    "barangay_id": 0.15,
}

# WHAT: Field names used when computing data-quality scores.
# WHY: Derived once from QUALITY_WEIGHTS so the two can never disagree.
QUALITY_FIELDS = list(QUALITY_WEIGHTS.keys())

# National-level sector demand breakdown (reference data, MT). Not stored in the
# demand_benchmarks table (which holds annual supply/demand figures); served as a
# labeled reference constant for the sector breakdown visualisation.
SECTOR_DEMAND = {
    "household": 320000.0,
    "foodProcessing": 180000.0,
    "industry": 120000.0,
    "agriculture": 63608.0,
}

SECTOR_DEMAND_NOTE = (
    "Reference national sector breakdown by end use. Not derived from "
    "production_records; shown for context only."
)