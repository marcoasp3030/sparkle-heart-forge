
ALTER TABLE public.company_notification_templates 
ADD COLUMN channel text NOT NULL DEFAULT 'whatsapp';

ALTER TABLE public.company_notification_templates 
DROP CONSTRAINT company_notification_templates_company_id_type_key;

ALTER TABLE public.company_notification_templates 
ADD CONSTRAINT company_notification_templates_company_id_type_channel_key 
UNIQUE (company_id, type, channel);
