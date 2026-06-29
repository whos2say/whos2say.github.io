# DJR Gallery Mapping Guide

This guide explains how David can connect DJR website sections to photo albums from the admin editor.

## Where To Edit

Open `/admin/`, then go to:

`DJR Photography` -> `Section Gallery Mapper`

Each row maps one homepage section, such as `David's Story`, `Featured Story`, `Eye to Eye / Creative Feature`, or `About David`, to an album card shown on that section.

## Mapping A Photo Gallery App Album

Use this when the photos are already in the site's Photo Gallery App.

1. Open the album in the Photo Gallery App.
2. Copy the ID from the URL:

   `album.html?album=THE-ALBUM-ID`

3. In `/admin/`, open `DJR Photography` -> `Section Gallery Mapper`.
4. Choose the section you want to update.
5. Set `Source Type` to `Photo Gallery App album`.
6. Paste the ID into `Photo Gallery App Album ID`.
7. Optionally set a custom title, description, cover image, and button label.

Photo Gallery App albums open inside the site's album viewer, so they support the existing lightbox, slideshow, download, and album features.

## Mapping A Google Photos Album

Use this when the photos are still in Google Photos and you want the website to link to them.

1. Open the album in Google Photos.
2. Share the album and copy the shared album link.
3. In `/admin/`, open `DJR Photography` -> `Section Gallery Mapper`.
4. Choose the section you want to update.
5. Set `Source Type` to `Google Photos shared album`.
6. Paste the link into `Google Photos Shared Album URL`.
7. Add a `Cover Image`. This is important because the website cannot reliably read private Google Photos album covers without Google authentication.

Google Photos mappings open in Google Photos. They do not import the photos into the site. To bring Google Photos into the full Photo Gallery App experience, use the existing Photo Gallery upload/import flow first, then map the created Photo Gallery App album ID.

## Gallery Page Cards

The same source types are available in:

`DJR Photography` -> `Galleries`

Use this for the filterable `/djr/galleries.html` page. Each card can be a Photo Gallery App album or a Google Photos shared album.

## Recommended Workflow

For finished portfolio sections, prefer Photo Gallery App albums. They keep people on the site and use the full gallery experience.

For quick drafts, temporary collections, or albums David is still organizing, use Google Photos shared album links with a strong cover image.
