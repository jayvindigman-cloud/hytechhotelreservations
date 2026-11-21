import ReviewPhotoRating from "./ReviewPhotoRating";
﻿import { useCallback, useEffect, useState } from "react";
import { accountFetch, readJson } from "../hotel-api";

export default function GuestReviews({ api, user, onLogin, rooms = [], onOpenRoom, embedded = false }) {
  const [reviews, setReviews] = useState([]);
  const [stays, setStays] = useState(null);
  const [selected, setSelected] = useState("");
  const [room, setRoom] = useState("");
  const [publicError, setPublicError] = useState("");
  const [stayError, setStayError] = useState("");

  const refreshReviews = useCallback(async (signal) => {
    try {
      const data = await fetch(api + "/reviews", { signal }).then(readJson);
      if (!signal?.aborted) setReviews(data);
    } catch {
      if (!signal?.aborted) setPublicError("Reviews could not load.");
    }
  }, [api]);

  useEffect(() => {
    if (embedded) return;
    const controller = new AbortController();
    refreshReviews(controller.signal);
    return () => controller.abort();
  }, [embedded, refreshReviews]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    accountFetch(api + "/reviews/mine", { signal: controller.signal }).then(readJson)
      .then((data) => { if (!controller.signal.aborted) setStays(data); })
      .catch((error) => { if (!controller.signal.aborted) setStayError(error.message); });
    return () => controller.abort();
  }, [api, user?.uid]);

  const stay = stays?.find((item) => String(item.id) === selected);
  const roomOptions = [...new Set(reviews.map((item) => item.roomType).filter(Boolean))];
  const shownReviews = room ? reviews.filter((item) => item.roomType === room) : reviews;

  return (
    <section id={embedded ? undefined : "reviews"} className="guest-reviews hotel-glass">
      <div className="review-stars" aria-hidden="true">{"\u2605 ".repeat(5)}</div>
      <h2>{embedded ? "Review your stay" : "How was your stay?"}</h2>
      <p>Choose a completed reservation to rate its room and service.</p>
      {!user ? <button type="button" className="hotel-action" onClick={onLogin}>Sign in to leave a review</button>
        : stayError ? <p role="status">{stayError}</p>
        : stays === null ? <p role="status">Loading completed stays...</p>
        : !stays.length ? <p>No completed stays to review yet.</p>
        : <>
          <label className="review-stay-picker">Completed stay
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">Choose a room reservation</option>
              {stays.map((item) => <option value={item.id} key={item.id}>
                {item.roomType} {"\u00b7"} {item.checkIn} to {item.checkOut} {"\u00b7"} {item.code}{item.hotelRating ? " (reviewed)" : ""}
              </option>)}
            </select>
          </label>
          {stay && <StayReviewForm key={stay.id} api={api} stay={stay} onSaved={(ratings) => {
            setStays((items) => items.map((item) => item.id === stay.id ? { ...item, ...ratings } : item));
            if (!embedded) refreshReviews();
          }} />}
        </>}
      {publicError && <p role="status">{publicError}</p>}
      {!embedded && roomOptions.length > 0 && <label className="review-stay-picker">Browse reviews by room
        <select value={room} onChange={(event) => setRoom(event.target.value)}>
          <option value="">All rooms</option>{roomOptions.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>}
      {shownReviews.length > 0 && (
        <div className="guest-review-list" aria-label="Guest reviews">
          {shownReviews.map((review, index) => {
            const reviewedRoom = rooms.find((item) => item.name === review.roomType);
            return <article key={index} className="hotel-glass">
            {reviewedRoom?.image && onOpenRoom && (
              <button type="button" className="review-room-photo" aria-label={"View " + reviewedRoom.name + " details"} aria-haspopup="dialog"
                onClick={() => onOpenRoom(reviewedRoom)}>
                <img src={reviewedRoom.image} alt={reviewedRoom.name} loading="lazy" />
                <ReviewPhotoRating rating={review.hotelRating} />
                <span>View room details</span>
              </button>
            )}
            <strong>{review.name}</strong>
            <div>{review.roomType ? review.roomType + " \u00b7 Room " : "Hotel "}{review.hotelRating}/5 {"\u00b7"} Service {review.serviceRating}/5</div>
            {review.comment && <p>{review.comment}</p>}
          </article>;
          })}
        </div>
      )}
    </section>
  );
}

function StayReviewForm({ api, stay, onSaved }) {
  const [ratings, setRatings] = useState({ hotelRating: stay.hotelRating || 0, serviceRating: stay.serviceRating || 0, comment: stay.comment || "" });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!ratings.hotelRating || !ratings.serviceRating || busy) return;
    setBusy(true);
    try {
      const saved = await accountFetch(api + "/reviews/mine/" + stay.id, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ratings),
      }).then(readJson);
      setStatus(saved.message);
      onSaved(ratings);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="guest-review-form">
      {[["hotelRating", "Room"], ["serviceRating", "Service"]].map(([key, label]) => (
        <fieldset key={key}>
          <legend>{label}</legend>
          {[1, 2, 3, 4, 5].map((rating) => <label key={rating}>
            <input type="radio" name={key} value={rating} checked={ratings[key] === rating}
              onChange={() => setRatings({ ...ratings, [key]: rating })} aria-label={rating + " out of 5"} />
            <span aria-hidden="true">{ratings[key] >= rating ? "\u2605" : "\u2606"}</span>
          </label>)}
        </fieldset>
      ))}
      <label>Comment (optional)<textarea rows={3} maxLength={1000} value={ratings.comment}
        onChange={(event) => setRatings({ ...ratings, comment: event.target.value })} /></label>
      <button className="hotel-action" disabled={busy || !ratings.hotelRating || !ratings.serviceRating}>{stay.hotelRating ? "Update review" : "Publish review"}</button>
      {status && <p role="status">{status}</p>}
    </form>
  );
}
