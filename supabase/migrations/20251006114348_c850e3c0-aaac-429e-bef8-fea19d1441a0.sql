-- Create table for file import history
CREATE TABLE public.file_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  records_imported INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  import_type TEXT NOT NULL, -- 'donations' or 'expenses' or 'mixed'
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'failed', 'reverted'
  error_log JSONB,
  imported_data JSONB, -- Store the imported records for audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reverted_at TIMESTAMP WITH TIME ZONE,
  reverted_by UUID
);

-- Enable RLS
ALTER TABLE public.file_imports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own imports"
ON public.file_imports
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create imports"
ON public.file_imports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own imports"
ON public.file_imports
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_file_imports_user_id ON public.file_imports(user_id);
CREATE INDEX idx_file_imports_created_at ON public.file_imports(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_file_imports_updated_at
BEFORE UPDATE ON public.file_imports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add import_id to donations and expenses for tracking
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES public.file_imports(id);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES public.file_imports(id);