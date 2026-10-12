# Webstore fixtures

Observed October 12, 2026 (Asia/Jakarta) through unauthenticated Axios GETs to the official Point Blank website:

- `webstore-trending.html`: `/webstore/more/best`, ten products, eight catalogue pages.
- `webstore-trending-2.html`: `/webstore/more/best?page=2`, ten different products, active page two.
- `webstore-trending-8.html`: `/webstore/more/best?page=8`, two products, disabled Next/Last links.
- `webstore-new.html`: `/webstore/more/new`, five products on one page. An initial connection reset was followed by a usable HTTP 200 response.
- `webstore-sale.html`: `/webstore/more/sale`, ten products, six catalogue pages.
- `webstore-star.html`: `/webstore/more/star`, ten products, seven catalogue pages, explicit rating text and Golden Ticket prices.

These are minimized observed catalogue excerpts. They preserve the category container, complete product lists and pagination. Unrelated navigation, account UI, headings and scripts were removed; whitespace between tags was collapsed. No product data or pagination targets were invented. Product links retain the website's own query parameters.

`webstore-public-actions.html` is an observed script excerpt from the same public Trending response. It retains the five uninvoked login-only shopping action declarations. Tests append it to minimized catalogue markup to verify that a public listing is accepted while actual redirects/action invocations and challenges still fail.

`webstore-index-supplied.html` is an excerpt of the user's supplied index HTML, not a live observation. Its four `.goods` sections are preserved. It has category preview lists and no catalogue pagination, so it tests product extraction only.

Tests which mutate these excerpts (missing fields, empty lists, invalid links, hostile text and changed selectors) explicitly use synthetic variations. Raw research captures remain ignored under `research/`. No unit test contacts Point Blank or Discord.
