def test_producer_creation_rejects_other_sex(admin_client):
    response = admin_client.post(
        "/api/producers",
        json={
            "name": "Test Salt Farmer",
            "age": 30,
            "sex": "Other",
            "address": "Test address",
            "barangay_id": 999999,
        },
    )

    assert response.status_code == 400
    assert "Sex must be Male or Female." in response.get_json()["errors"]
