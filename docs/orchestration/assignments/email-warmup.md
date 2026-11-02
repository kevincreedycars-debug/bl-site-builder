# Assignment — email-warmup

Owner: `email-ops`. Writes one file: `data/email.json`.

## What it is for

Keep the sending side honest: which domains are authenticated, which mailboxes
are warm enough to send, and which are paused because sending would cost more
than it earns.

## Reads

- `data/email.json` — sending domains, authentication records, mailboxes, caps,
  bounce and complaint rates.

## Writes

`data/email.json`, and nothing else. No SMTP password, no API key, no token is
ever written here; this file is published.

## Finished when

- Every sending domain has `spf`, `dkim` and `dmarc` recorded as seen in this run,
  or as unknown with the reason.
- Every mailbox has today's volume against its cap, and a bounce and complaint
  rate with the window they were measured over.
- A domain or mailbox that failed is paused, and the reason is in the file.

## Stop and ask when

- A domain is listed on a blocklist. Stop sending from it; warming a different
  domain is a decision, not a workaround to take alone.
- Bounce is above the fail line, or complaints any time this month. Sending
  through it to keep volume up spends reputation that cannot be bought back.
- Someone asks to send at a volume above the cap. That is a business decision
  with a technical cost, and both halves have to agree.

## Evidence that counts

    DKIM missing, DMARC none      a domain that will be binned, not delivered
    bounce 7.4%, complaints 0.11% a mailbox that is already hurting
    listed on spamrats            stop, do not send and watch

Mail sent from a domain that fails authentication trains receivers to bin the
whole domain. That cost lands on every later send, including the ones that work.
