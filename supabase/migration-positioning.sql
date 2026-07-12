-- Client positioning document (Batch 1 — AI copy grounding)
-- `positioning_pdf_path`: storage path of the uploaded source positioning PDF.
-- `positioning`: AI-distilled free text extracted from the PDF, injected into copy generation.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS positioning_pdf_path TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS positioning TEXT;
