# Migration and Setup Guide

## Step 1: Run the Database Migration

You have two options to run the migration:

### Option A: Using Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of `supabase/migrations/003_document_embeddings.sql`
5. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)

### Option B: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Link to your Supabase project (if not already linked)
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

Or run the specific migration:

```bash
# Apply migration directly
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/003_document_embeddings.sql
```

## Step 2: Set Up Environment Variables

Make sure you have a `.env.local` file in the root directory with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (for generating embeddings)
OPENAI_API_KEY=your-openai-api-key

# Anthropic (for AI agents)
ANTHROPIC_API_KEY=your-anthropic-api-key

# Perplexity (for research)
PERPLEXITY_API_KEY=your-perplexity-api-key
```

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Run the Development Server

```bash
npm run dev
```

The application will start at: **http://localhost:3000**

## Step 5: Access the Knowledge Graph

1. Navigate to: **http://localhost:3000/knowledge**
2. Or click "Knowledge Graph" in the header navigation

## Step 6: Load Demo Data (Optional)

1. Go to `/knowledge` page
2. Click the **"Load Demo Data"** button
3. Enter your OpenAI API key when prompted
4. Wait for embeddings to be generated (takes ~30 seconds)
5. The graph will automatically refresh

## Troubleshooting

### Migration Fails

- Make sure the `vector` extension is enabled in your Supabase project
- Check that the `documents` table exists (from migration 002)
- Verify you have the correct database permissions

### No Embeddings Showing

- Make sure you've run debates that generate documents with embeddings
- Or load the demo data using the button on the knowledge page
- Check the browser console for any errors

### Slow Performance

- The first load might be slow as PCA calculations run
- Subsequent loads should be faster due to caching
- Consider limiting the number of documents if you have thousands

