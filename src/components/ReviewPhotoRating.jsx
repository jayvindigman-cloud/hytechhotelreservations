export default function ReviewPhotoRating({ rating }) {
  const stars = Number(rating);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return null;
  return (
    <span className="review-photo-rating" aria-label={stars + " out of 5 stars"}>
      <span aria-hidden="true">{"\u2605".repeat(stars)}{"\u2606".repeat(5 - stars)}</span>
      <strong aria-hidden="true">{stars}/5</strong>
    </span>
  );
}
