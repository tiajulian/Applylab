export interface ScrapedJobDetails {
  jobTitle: string;
  companyName: string;
  location: string;
  jobUrl: string;
  platform: 'SEEK' | 'LinkedIn' | 'Workday' | 'PageUp' | 'LiveHire' | 'Other';
}

// Many ATS platforms (Dayforce, Greenhouse, iCIMS, etc.) embed Google-for-Jobs structured data
// even when they don't get a bespoke scraper below - use it before falling back to raw page title.
function readJobPostingJsonLd(): { jobTitle?: string; companyName?: string; location?: string } {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script.textContent || 'null');
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of candidates) {
        if (candidate && candidate['@type'] === 'JobPosting') {
          const org = candidate.hiringOrganization;
          const location = candidate.jobLocation?.address?.addressLocality
            || candidate.jobLocation?.address?.addressRegion;
          return {
            jobTitle: typeof candidate.title === 'string' ? candidate.title.trim() : undefined,
            companyName: typeof org?.name === 'string' ? org.name.trim() : undefined,
            location: typeof location === 'string' ? location.trim() : undefined,
          };
        }
      }
    } catch {
      // Malformed JSON-LD on the page - ignore and keep looking.
    }
  }
  return {};
}

function companyNameFromHostname(): string {
  const host = window.location.hostname.replace(/^www\./, '');
  const label = host.split('.')[0];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export class JobScraper {
  static extract(): ScrapedJobDetails {
    const url = window.location.href;

    // 1. SEEK
    if (url.includes('seek.com.au')) {
      return {
        jobTitle: document.querySelector('[data-automation="job-detail-title"]')?.textContent?.trim() 
          || document.querySelector('h1')?.textContent?.trim() 
          || document.title,
        companyName: document.querySelector('[data-automation="advertiser-name"]')?.textContent?.trim() 
          || document.querySelector('[data-automation="job-detail-company"]')?.textContent?.trim() 
          || 'Unknown Company',
        location: document.querySelector('[data-automation="job-detail-location"]')?.textContent?.trim() || 'Australia',
        jobUrl: url.split('?')[0],
        platform: 'SEEK'
      };
    }

    // 2. LinkedIn
    if (url.includes('linkedin.com')) {
      return {
        jobTitle: document.querySelector('.job-details-jobs-unified-top-card__job-title, h1, .jobs-unified-top-card__job-title')?.textContent?.trim() || document.title,
        companyName: document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, a.app-aware-link')?.textContent?.trim() || 'Unknown Company',
        location: document.querySelector('.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet')?.textContent?.trim() || 'Australia',
        jobUrl: url.split('?')[0],
        platform: 'LinkedIn'
      };
    }

    // 3. Workday
    if (url.includes('myworkdayjobs.com') || url.includes('workday.com')) {
      return {
        jobTitle: document.querySelector('[data-automation-id="jobPostingHeader"]')?.textContent?.trim() || document.title,
        companyName: document.querySelector('[data-automation-id="companyName"]')?.textContent?.trim() || 'Workday Employer',
        location: document.querySelector('[data-automation-id="locations"]')?.textContent?.trim() || 'Australia',
        jobUrl: url.split('?')[0],
        platform: 'Workday'
      };
    }

    // 4. PageUp
    if (url.includes('pageuppeople.com')) {
      return {
        jobTitle: document.querySelector('#job-details h1, .job-title, h1')?.textContent?.trim() || document.title,
        companyName: document.querySelector('.company-name, .logo-title')?.textContent?.trim() || 'PageUp Employer',
        location: document.querySelector('.job-location, .location')?.textContent?.trim() || 'Australia',
        jobUrl: url.split('?')[0],
        platform: 'PageUp'
      };
    }

    // 5. LiveHire
    if (url.includes('livehire.com')) {
      return {
        jobTitle: document.querySelector('.job-header-title, h1')?.textContent?.trim() || document.title,
        companyName: document.querySelector('.job-header-company, .company-name')?.textContent?.trim() || 'LiveHire Employer',
        location: document.querySelector('.job-header-location')?.textContent?.trim() || 'Australia',
        jobUrl: url.split('?')[0],
        platform: 'LiveHire'
      };
    }

    const jsonLd = readJobPostingJsonLd();
    return {
      jobTitle: jsonLd.jobTitle || document.title,
      companyName: jsonLd.companyName || companyNameFromHostname(),
      location: jsonLd.location || 'Australia',
      jobUrl: url,
      platform: 'Other'
    };
  }
}
