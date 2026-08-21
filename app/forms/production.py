from flask_wtf import FlaskForm
from wtforms import SelectField, DateField, StringField, DecimalField, IntegerField, SubmitField
from wtforms.validators import DataRequired, Optional as WTFormsOptional, NumberRange
from app.models.municipality import Municipality


class ProductionRecordForm(FlaskForm):
    period_type = SelectField("Period Type", choices=[("daily", "Daily"), ("monthly", "Monthly"), ("annual", "Annual")], validators=[DataRequired()])
    record_date = DateField("Record Date", validators=[DataRequired()])
    barangay = StringField("Barangay", validators=[DataRequired()])
    production_volume = DecimalField("Production Volume", validators=[DataRequired(), NumberRange(min=0)])
    production_method = SelectField("Production Method", choices=[("solar_evaporation", "Solar Evaporation"), ("cooked", "Cooked"), ("hybrid", "Hybrid")], validators=[DataRequired()])
    production_area = DecimalField("Production Area", validators=[DataRequired(), NumberRange(min=0)])
    num_salt_beds = IntegerField("Number of Salt Beds", validators=[DataRequired(), NumberRange(min=0)])
    producer_age = IntegerField("Producer Age (optional)", validators=[WTFormsOptional(), NumberRange(min=0, max=120)])
    producer_gender = StringField("Producer Gender (optional)", validators=[WTFormsOptional()])
    submit = SubmitField("Submit for Validation")
    save_draft = SubmitField("Save as Draft")
