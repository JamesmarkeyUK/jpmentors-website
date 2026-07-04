# JP Mentors — website

The website for **JP Mentors**, a boutique UK technology consultancy specialising in
**virtual reality, haptics, robotics and artificial intelligence**, founded by
**James Markey MBE** in November 2017 ([Companies House 11077479](https://find-and-update.company-information.service.gov.uk/company/11077479)).

> *Classic training, made modern.*

A fast, dependency-free static site — plus a browser-playable **JP Mentors Penalty Shootout**
game alongside photos of the JP Mentors–sponsored youth football team.

## Structure

```
index.html            # single-page site
assets/
  styles.css          # all styling (brand: kit red / ink charcoal)
  main.js             # nav, scroll reveal, mobile menu
  game.js             # canvas penalty-shootout game
  img/                # optimised images (logo, team, founder, clients)
CNAME                 # custom domain for GitHub Pages
.nojekyll             # serve files as-is (no Jekyll processing)
```

No build step, no framework — open `index.html` or serve the folder.

## Local preview

```
cd /path/to/JPMentors_Website
python3 -m http.server 4321
```

Then visit <http://localhost:4321>.

## Deployment — GitHub Pages

This repo is designed to be served directly by **GitHub Pages** from the `main` branch root.

1. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch `main`, folder `/ (root)`.
2. The included `CNAME` sets the custom domain to `www.jpmentors.co.uk`.
3. To go live on that domain, point DNS at GitHub Pages (replacing the current host):
   - `CNAME` record for `www` → `<username>.github.io`
   - (optional) apex `A`/`ALIAS` records per
     [GitHub's Pages DNS guide](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site).
4. Enable **Enforce HTTPS** once the certificate is issued.

## The game

`assets/game.js` is a self-contained HTML5 canvas penalty shootout: aim with the pointer,
hold to charge an oscillating power meter, release to shoot, and try to beat the keeper over
five penalties. Themed in the team's red-and-black kit.

## Credits

Photography and logo © JP Mentors. Built as a static site — content adapted from the previous
jpmentors.co.uk.
