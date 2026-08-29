from flask_wtf import FlaskForm
from wtforms import SelectField, DateField, SubmitField
from wtforms.validators import DataRequired, Optional as WTFormsOptional
from app.models.municipality import Municipality


class ReportForm(FlaskForm):
    report_type = SelectField("Report Type", choices=[
        ("provincial", "Provincial"),
        ("municipality", "Municipality"),
        ("forecast", "Forecast"),
        ("data_quality", "Data Quality"),
        ("supply_demand", "Supply and Demand"),
        ("gis", "GIS Map"),
    ], validators=[DataRequired()])
    municipality_id = SelectField("Municipality (optional)", coerce=int, validators=[WTFormsOptional()])
    date_range_start = DateField("Date Range Start", validators=[WTFormsOptional()])
    date_range_end = DateField("Date Range End", validators=[WTFormsOptional()])
    generate = SubmitField("Generate")

    def __init__(self, *args, **kwargs):
        super(ReportForm, self).__init__(*args, **kwargs)
        self.municipality_id.choices = [(0, "All Municipalities")] + [(m.id, m.name) for m in Municipality.query.order_by(Municipality.name).all()]
