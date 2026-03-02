
-- Add church_cnpj to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS church_cnpj text;

-- Add cpf_cnpj to donors
ALTER TABLE public.donors ADD COLUMN IF NOT EXISTS cpf_cnpj text;

-- Add attachment_url to donations and expenses
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS attachment_url text;

-- Create storage bucket for transaction attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('transaction-attachments', 'transaction-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can only access their own folder
CREATE POLICY "Users can upload their own attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'transaction-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'transaction-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'transaction-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'transaction-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
