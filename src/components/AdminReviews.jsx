import ReviewPhotoRating from "./ReviewPhotoRating";
import { roomDescriptions } from "../data/hotelCatalog";
﻿import { useEffect, useState } from "react";
import { accountFetch, readJson } from "../hotel-api";

export default function AdminReviews({ api, rooms }) {
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    accountFetch(api + "/admin/reviews", { signal: controller.signal }).then(readJson).then(setReviews)
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [api]);
  return (
    <section className="hotel-glass admin-directory">
      <h3>Guest reviews</h3>
      {error ? <p role="alert">{error}</p> : reviews === null ? <p role="status">Loading reviews...</p> : !reviews.length ? <p>No reviews yet.</p> : (
        <ul className="directory-bookings">
          {reviews.map((review) => {
            const room = rooms.find((item) => item.name === review.roomType);
            const photo = room?.image || roomDescriptions.find((item) => item.name === review.roomType)?.image;
            return <li className="hotel-glass" key={review.id}>
              <header><strong>{review.name}</strong><span>{review.roomType ? "Room" : "Hotel"} {review.hotelRating}/5 {"·"} Service {review.serviceRating}/5</span></header>
              {review.roomType && <p><strong>{review.roomType}</strong> {"\u00b7"} {review.reservationCode}</p>}
              {photo && <a className="review-room-photo admin-review-photo" href={photo} target="_blank" rel="noreferrer" aria-label={"Open " + review.roomType + " photo"}>
                <img src={photo} alt={review.roomType} loading="lazy" />
                <ReviewPhotoRating rating={review.hotelRating} />
              </a>}
              <p>{review.comment || "Rating only"}</p>
              <small>{String(review.updatedAt || "").slice(0, 10)}</small>
            </li>;
          })}
        </ul>
      )}
    </section>
  );
}
