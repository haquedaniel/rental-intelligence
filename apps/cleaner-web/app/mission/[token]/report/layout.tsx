import type { ReactNode } from "react";

export default function ChecklistReportLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <style>{`
        input[type="file"][name^="photo_"].hidden {
          display: block !important;
          width: 100%;
          color: transparent;
          font-size: 0;
          cursor: pointer;
        }

        input[type="file"][name^="photo_"].hidden::file-selector-button {
          width: 100%;
          min-height: 3.5rem;
          margin: 0;
          border: 0;
          border-radius: 1rem;
          padding: 1rem;
          background: #dc2626;
          color: #ffffff;
          font: inherit;
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
        }

        input[type="file"][name^="photo_"].hidden + label {
          display: none !important;
        }
      `}</style>
      {children}
    </>
  );
}
