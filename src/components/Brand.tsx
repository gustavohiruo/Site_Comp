import { Link } from "react-router-dom";

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Telinha — início">
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-dot" />
      </span>
      <span className="brand-name">Telinha</span>
    </Link>
  );
}
