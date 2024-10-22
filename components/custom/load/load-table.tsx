import { Payment, columns } from "@/components/custom/data-table/columns";
import { DataTable } from "@/components/custom/data-table/data-table";

export async function getData(): Promise<Payment[]> {
  // Sample data to mimic API fetch
  return [
    {
      id: "728ed52f",
      amount: 100,
      currency: "USD",
      transactionDate: "2024-10-15",
      status: "pending",
      email: "m@example.com",
      customerName: "John Doe",
      customerCountry: "United States",
    },
    {
      id: "985d71a9",
      amount: 250.5,
      currency: "EUR",
      transactionDate: "2024-10-16",
      status: "success",
      email: "jane.doe@example.com",
      customerName: "Jane Doe",
      customerCountry: "Germany",
    },
    {
      id: "ad9f79b0",
      amount: 75.75,
      currency: "GBP",
      transactionDate: "2024-10-17",
      status: "processing",
      email: "will.smith@example.com",
      customerName: "Will Smith",
      customerCountry: "United Kingdom",
    },
    {
      id: "b5f314c7",
      amount: 499.99,
      currency: "USD",
      transactionDate: "2024-10-18",
      status: "failed",
      email: "emma.stone@example.com",
      customerName: "Emma Stone",
      customerCountry: "Canada",
    },
  ];
}

export default async function LoadTable() {
  const data = await getData();

  return (
    <div className="mx-2">
      <DataTable columns={columns} data={data} />
    </div>
  );
}
