import { useEffect, useMemo, useState } from "react";
import AdminResourcePage from "../../components/AdminResourcePage";
import {
  deleteAdminResource,
  getAdminResource,
  getVehicleFormOptions,
  upsertAdminResource
} from "../../services/travelService";
import { validateVehicleForm } from "../../utils/formValidation";

function AdminVehiclesPage() {
  const [records, setRecords] = useState([]);
  const [operatorOptions, setOperatorOptions] = useState([]);

  const loadRecords = async () => {
    const result = await getAdminResource("vehicles");
    setRecords(result);
  };

  const loadOptions = async () => {
    const result = await getVehicleFormOptions();
    setOperatorOptions(result.operators);
  };

  useEffect(() => {
    loadRecords();
    loadOptions();
  }, []);

  const fields = useMemo(
    () => [
      {
        name: "operator_id",
        label: "Operator",
        type: "select",
        options: operatorOptions
      },
      { name: "vehicle_number", label: "Vehicle Number" },
      { name: "vehicle_name", label: "Vehicle Name" },
      { name: "total_seats", label: "Total Seats", type: "number" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: ["active", "inactive"]
      }
    ],
    [operatorOptions]
  );

  const handleSave = async (record) => {
    await upsertAdminResource("vehicles", record);
    await loadRecords();
  };

  const handleDelete = async (recordId) => {
    await deleteAdminResource("vehicles", recordId);
    await loadRecords();
  };

  const renderValue = (record, field) => {
    if (field.name === "operator_id") {
      const found = operatorOptions.find(
        (opt) => String(opt.value) === String(record.operator_id)
      );
      return found ? found.label : record.operator_id;
    }
    return record[field.name];
  };

  return (
    <AdminResourcePage
      title="Vehicles"
      description="Add and manage vehicles. Mode is determined by the chosen operator. Only active vehicles can be assigned to routes; making a vehicle inactive removes its dependent routes and schedules."
      fields={fields}
      records={records}
      onSave={handleSave}
      onDelete={handleDelete}
      renderValue={renderValue}
      validateForm={(form) => validateVehicleForm(form, operatorOptions)}
    />
  );
}

export default AdminVehiclesPage;
