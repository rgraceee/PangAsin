from app.models.sector_demand_setting import (
    SECTOR_DEMAND_SCOPES,
    SectorDemandSetting,
)


def build_sector_demand_by_scope(totals_by_scope):
    result = {}
    for scope in SECTOR_DEMAND_SCOPES:
        totals = totals_by_scope.get(scope, {})
        sectors = (
            SectorDemandSetting.query
            .filter_by(geographic_scope=scope)
            .order_by(SectorDemandSetting.id)
            .all()
        )
        result[scope] = [
            {
                "id": sector.id,
                "name": sector.sector_name,
                "percentage": float(sector.percentage),
                "demand_mt": _allocated_amount(totals.get("demand"), sector.percentage),
                "supply_mt": _allocated_amount(totals.get("supply"), sector.percentage),
                "production_mt": _allocated_amount(
                    totals.get("production"), sector.percentage
                ),
            }
            for sector in sectors
        ]
    return result


def serialize_sector_settings_by_scope():
    settings = SectorDemandSetting.query.order_by(SectorDemandSetting.id).all()
    result = {scope: [] for scope in SECTOR_DEMAND_SCOPES}
    for setting in settings:
        result[setting.geographic_scope].append({
            "id": setting.id,
            "name": setting.sector_name,
            "percentage": float(setting.percentage),
        })
    return result


def _allocated_amount(total, percentage):
    if total is None:
        return 0.0
    return round(float(total) * float(percentage) / 100, 2)
