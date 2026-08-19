-- KA Farm - Table de feedback utilisateur
-- À exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.feedback (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note INTEGER NOT NULL CHECK (note >= 1 AND note <= 4),
  message TEXT,
  user_id UUID,
  
  -- Clé étrangère vers la table des utilisateurs (optionnel)
  CONSTRAINT fk_feedback_user 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL
);

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_note ON public.feedback(note);

-- Politique RLS (Row Level Security) : 
-- Les utilisateurs peuvent lire tous les feedbacks, mais seul l'admin peut modifier/supprimer
-- Pour l'instant, on permet l'insertion publique (anonyme)

-- Activer RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Politique : Tout le monde peut lire les feedbacks (optionnel, retirer si confidentiel)
CREATE POLICY "Allow public read access" ON public.feedback
  FOR SELECT USING (true);

-- Politique : Tout le monde peut insérer un feedback (anonyme ou authentifié)
CREATE POLICY "Allow public insert" ON public.feedback
  FOR INSERT WITH CHECK (true);

-- Politique : Seuls les admins peuvent modifier/supprimer
-- Vérifie le rôle admin via les claims JWT (auth.jwt() ->> 'role' = 'admin')
-- Nécessite que le rôle admin soit défini dans les claims JWT de l'utilisateur
CREATE POLICY "Allow admin update delete" ON public.feedback
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND COALESCE(auth.jwt() ->> 'role', '') = 'admin'
  )
  USING (
    auth.role() = 'authenticated'
    AND COALESCE(auth.jwt() ->> 'role', '') = 'admin'
  );

-- Politique : Seuls les admins peuvent supprimer
CREATE POLICY "Allow admin delete" ON public.feedback
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND COALESCE(auth.jwt() ->> 'role', '') = 'admin'
  );

-- Vue matérialisée pour les statistiques (optionnel)
CREATE OR REPLACE VIEW feedback_stats AS
SELECT 
  COUNT(*) as total_feedbacks,
  ROUND(AVG(note::numeric), 2) as average_note,
  COUNT(CASE WHEN note = 1 THEN 1 END) as negative_count,
  COUNT(CASE WHEN note = 2 THEN 1 END) as neutral_count,
  COUNT(CASE WHEN note = 3 THEN 1 END) as positive_count,
  COUNT(CASE WHEN note = 4 THEN 1 END) as very_positive_count,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as last_7_days,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as last_30_days
FROM public.feedback;

-- Accorder les permissions pour la vue
GRANT SELECT ON feedback_stats TO authenticated;

-- Donner les permissions sur la table feedback
GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT SELECT, INSERT ON public.feedback TO anon;

-- Commentaires pour la documentation
COMMENT ON TABLE public.feedback IS 'Table de collecte de feedback utilisateur pour KA Farm';
COMMENT ON COLUMN public.feedback.note IS 'Note de satisfaction : 1=😞, 2=😐, 3=🙂, 4=😃';
COMMENT ON COLUMN public.feedback.message IS 'Commentaire libre de l''utilisateur';
COMMENT ON COLUMN public.feedback.user_id IS 'ID de l''utilisateur connecté (NULL si anonyme)';