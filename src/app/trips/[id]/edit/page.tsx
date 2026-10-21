import { TripForm } from "@components/trips/TripForm";
import { notFound } from "next/navigation";
import { getTripById } from "@server/tripService";
import { toLocalDateTime } from "@lib/timezone";

type EditTripPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTripPage({ params }: EditTripPageProps) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();

  const trip = await getTripById(id);
  if (!trip) notFound();

  return (
    <TripForm
      tripId={trip.id}
      initialValues={{
        name: trip.name,
        origin: trip.origin,
        originTimeZone: trip.originTimeZone,
        destination: trip.destination,
        destinationTimeZone: trip.destinationTimeZone,
        departureLocal: toLocalDateTime(trip.departureAt, trip.originTimeZone),
        arrivalLocal: toLocalDateTime(trip.arrivalAt, trip.destinationTimeZone),
        notes: trip.notes ?? "",
      }}
    />
  );
}
