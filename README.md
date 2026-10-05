# Shared Pocket Songbook

Editable React/TypeScript source with Supabase login, a private shared song database, owner/editor/viewer permissions, existing chord transposition and sharing, and Netlify deployment configuration.

Start with **SETUP.md**. This package needs a Supabase project and frontend environment variables before login/database functionality is usable. It is not a live deployment. Live account/database permission verification is pending.

Run `npm ci`, configure `.env.local` using `.env.example`, then `npm run dev`. Run `npm run build` for deployment. Upload `dist` to your own host or connect a repository to Netlify.

Original local-storage hosted app remains separate. Export its songs and import them once into the new library after account setup.
