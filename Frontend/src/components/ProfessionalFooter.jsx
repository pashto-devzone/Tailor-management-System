import { FaEnvelope, FaGlobe, FaWhatsapp } from "react-icons/fa";
import versionJson from "../../../version.json";
import "./ProfessionalFooter.css";


const VERSION =
  versionJson?.current ??
  versionJson?.version ??
  versionJson?.latest ??
  "1.6.5";

export default function ProfessionalFooter() {
  const website = "https://pashto-devzone.vercel.app";
  const whatsappLink = "https://wa.me/923245020658";

  return (
    <footer className="professional-footer">
      <div className="professional-footer__inner">
        <div className="professional-footer__content">
          <p className="professional-footer__marketing">
            Need a custom software, website or business automation solution? Contact <strong>Pashto DevZone</strong> today.
          </p>

          <div className="professional-footer__links">
            <a
              className="professional-footer__link"
              href={website}
              target="_blank"
              rel="noreferrer"
            >
              <FaGlobe /> Website
            </a>

            <a
              className="professional-footer__whatsapp-button"
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
            >
              <FaWhatsapp /> WhatsApp
            </a>

            <a
              className="professional-footer__email-button"
              href="mailto:m.yaseen.dev1@gmail.com"
              title="Send email"
            >
              <FaEnvelope /> Email
            </a>
          </div>
        </div>

        <div className="professional-footer__version">Version {VERSION}</div>
      </div>
    </footer>
  );
}
