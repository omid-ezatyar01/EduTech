import { Link } from "react-router";

export default function Logo() {
  return (
    <Link className="brand" to="/" aria-label="EduTech verification home">
      <img
        src="/logo.png"
        alt="EduTech logo"
        className="brand-logo"
        loading="eager"
      />
    </Link>
  );
}
