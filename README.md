# AI Resume Optimizer

## Resume Tailor

A modern Next.js web application for generating tailored resumes using AI. Users can log in, input their resume and job description, and receive a customized resume with keyword analysis and improvement suggestions.

## Features

- User authentication via Supabase
- AI-powered resume tailoring and keyword extraction
- Download and copy tailored resumes
- Responsive UI with reusable components
- Secure API endpoints for resume generation

## Project Structure

```
.
├── app/                  # Next.js app directory (pages, layout, API routes)
│   ├── login/            # Login page
│   ├── api/              # API endpoints
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Main entry point
├── components/           # Reusable UI and feature components
├── docs/                 # Project Report
├── lib/                  # Utility libraries (e.g., Supabase client)
├── public/               # Static assets
├── .env.example          # Example environment variables
├── package.json          # Project dependencies and scripts
└── README.md             # Project documentation
```

## Setup & Development

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env` and fill in your credentials.

3. **Run the development server:**
   ```sh
   npm run dev
   ```

4. **Open the app:**
   - Visit [http://localhost:3000](http://localhost:3000) in your browser.

---


## Sign in to [Supabase.com](https://supabase.com/)
**Go to SQL Editor and then run this Query**
  ```bash
-- Jobs table for metadata
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mongo_job_description_id TEXT NOT NULL,
    job_title TEXT,
    company_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resume generations tracking
CREATE TABLE resume_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    mongo_sample_resume_id TEXT NOT NULL,
    mongo_tailored_resume_id TEXT NOT NULL,
    match_score INTEGER DEFAULT 0,
    generation_status TEXT DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX idx_resume_generations_user_id ON resume_generations(user_id);
CREATE INDEX idx_resume_generations_job_id ON resume_generations(job_id);
CREATE INDEX idx_resume_generations_created_at ON resume_generations(created_at DESC);

   ```
## Usage

- **Log in securely** using your credentials to access the app.
- **Paste your existing resume** and the target job description into the provided fields.
- **Generate a tailored resume** that matches the job requirements using AI-powered suggestions.
- **View keyword analysis** to see which important terms are present or missing.
- **Copy or download** your improved resume for job applications.
- **Log out** to end your session securely.
  
---

## Deployment

https://airesumeoptimizer.vercel.app/

---

## License

Proprietary License

Copyright (c) 2025 Zain Allaudin

All rights reserved.

This software and associated documentation files (AI Resume Optimizer) are the exclusive property of Zain Allaudin. Unauthorized copying, modification, distribution, or use of the Software, in whole or in part, is strictly prohibited without prior written permission from the copyright holder.

The Software is provided "as is," without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement. In no event shall the copyright holder be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the Software or the use or other dealings in the Software.
