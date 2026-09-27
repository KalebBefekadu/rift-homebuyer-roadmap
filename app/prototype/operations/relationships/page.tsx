import { Suspense } from "react";
import { Table } from "./Table";

export default function Relationships() {
  return (
    <>
      <h1 className="ops-h1">Relationships</h1>
      <Suspense><Table /></Suspense>
    </>
  );
}
