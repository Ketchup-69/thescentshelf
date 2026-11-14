# Writes the plain HTML pages that search engines and AI assistants read:
#   perfume/<id>/          one page per perfume, with quick answers
#   house/<id>/            one page per house
#   smells-like/<id>/      the shelf perfumes compared to each designer bottle, plus smells-like/ (the list)
#   faq.html, sitemap.xml, robots.txt, llms.txt and the structured data in index.html
# Run it after changing data/products.json, then upload everything:
#   powershell -ExecutionPolicy Bypass -File build.ps1
# When the custom domain is live:  build.ps1 -Base https://thescentshelf.in/
param([string]$Base = 'https://ketchup-69.github.io/thescentshelf/')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Base.EndsWith('/')) { $Base += '/' }
$utf8 = New-Object Text.UTF8Encoding $false
$IN = [Globalization.CultureInfo]::GetCultureInfo('en-IN')
$INV = [Globalization.CultureInfo]::InvariantCulture
$R = [string][char]0x20B9
$DOT = [string][char]0x00B7
$today = (Get-Date).ToString('yyyy-MM-dd')
$cfg = [IO.File]::ReadAllText((Join-Path $root 'js\config.js'))
$rate = 88; if ($cfg -match 'USD_INR_RATE\s*=\s*([\d.]+)') { $rate = [double]$Matches[1] }

function HE([string]$s) { [Net.WebUtility]::HtmlEncode($s) }
function Inr($n) { $R + ([double]$n).ToString('N0', $IN) }
function Usd($n) { '$' + [Math]::Round([double]$n / $rate).ToString('N0', $INV) }
function Money($n) { '<span class="money"><span class="money__inr">' + (Inr $n) + '</span><span class="money__usd">' + (Usd $n) + '</span></span>' }
function Json($o) { $o | ConvertTo-Json -Depth 12 -Compress }
function A([string]$w) { if ($w -match '^[aeiou]') { 'an ' + $w } else { 'a ' + $w } }
function Lasts([int]$n) { switch ($n) { 1 { 'under 3 hours' } 2 { 'about 3 to 5 hours' } 3 { 'about 5 to 7 hours' } 4 { 'about 7 to 10 hours' } default { '10 hours or more' } } }
function AndList([string[]]$xs) { if ($xs.Count -le 1) { return ($xs -join '') }; (($xs[0..($xs.Count - 2)]) -join ', ') + ' and ' + $xs[-1] }
function Sub([string]$s, [string]$pattern, [string]$with) { [regex]::Replace($s, $pattern, $with.Replace('$', '$$')) }
function Save([string]$rel, [string]$html) { $p = Join-Path $root $rel; New-Item -ItemType Directory -Force (Split-Path $p) | Out-Null; [IO.File]::WriteAllText($p, $html, $utf8) }
$SHORT = @{ 'Eau de Parfum' = 'EDP'; 'Eau de Toilette' = 'EDT'; 'Eau de Cologne' = 'EDC'; 'Extrait de Parfum' = 'Extrait' }
$WHO = @{ M = 'leans masculine'; W = 'leans feminine'; U = 'works for anyone' }
$FAMILY = @{ fresh = 'Fresh'; citrus = 'Citrus'; aquatic = 'Aquatic'; green = 'Green'; floral = 'Floral'; fruity = 'Fruity'; sweet = 'Sweet'; spicy = 'Spicy'; woody = 'Woody'; amber = 'Amber'; musky = 'Musky'; leather = 'Leather'; oud = 'Oud' }

# ---------- Catalogue ----------
$data = [IO.File]::ReadAllText((Join-Path $root 'data\products.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
$brandById = @{}; foreach ($b in $data.brands) { $brandById[$b.id] = $b }
$products = New-Object System.Collections.ArrayList
$byId = @{}
$n = 0
foreach ($p in $data.products) {
  $n++
  $b = $brandById[$p.brand]
  $p | Add-Member -Force -NotePropertyName no -NotePropertyValue $n
  $p | Add-Member -Force -NotePropertyName house -NotePropertyValue $b
  $p | Add-Member -Force -NotePropertyName lux -NotePropertyValue ($b.group -ne 'Arabic')
  [void]$products.Add($p); $byId[$p.id] = $p
}
$twins = @{}
foreach ($p in $products) {
  if ($p.smells_like -and $byId.ContainsKey($p.smells_like)) {
    if (-not $twins.ContainsKey($p.smells_like)) { $twins[$p.smells_like] = New-Object System.Collections.ArrayList }
    [void]$twins[$p.smells_like].Add($p)
  }
}
function Orig($p) { if ($p.smells_like -and $byId.ContainsKey($p.smells_like)) { $byId[$p.smells_like] } else { $null } }
function Full($p) { $p.house.name + ' ' + $p.name }
function Size($p) { $c = [string]$p.concentration; if ($SHORT.ContainsKey($c)) { $c = $SHORT[$c] }; ((@("$($p.size_ml) ml", $c) | Where-Object { $_ }) -join ' ') }
function Fam($p) { [string]$p.family }
function PUrl($p) { 'perfume/' + $p.id + '/' }
function Bar([double]$v, [int]$w = 12) { '<span class="ameter" data-v="' + [Math]::Max(0, [Math]::Min(1, $v)).ToString('0.000', $INV) + '" data-w="' + $w + '" aria-hidden="true">[' + ($DOT * $w) + ']</span>' }
$org = [ordered]@{ '@id' = $Base + '#org' }

# ---------- Page shell from an existing page ----------
$tplPerfume = [IO.File]::ReadAllText((Join-Path $root 'perfume.html'))
$tplShop = [IO.File]::ReadAllText((Join-Path $root 'shop.html'))
$tplLux = [IO.File]::ReadAllText((Join-Path $root 'lux.html'))

function Shell([string]$tpl, [hashtable]$o) {
  $url = $Base + $o.path
  $s = $tpl
  $s = Sub $s '<title>[^<]*</title>' ('<title>' + (HE $o.title) + '</title>')
  $s = Sub $s '<meta name="description" content="[^"]*">' ('<meta name="description" content="' + (HE $o.desc) + '">')
  $s = Sub $s '<meta property="og:title" content="[^"]*">' ('<meta property="og:title" content="' + (HE $o.title) + '">')
  $s = Sub $s '<meta property="og:description" content="[^"]*">' ('<meta property="og:description" content="' + (HE $o.desc) + '">')
  $s = Sub $s '<meta property="og:url" content="[^"]*">' ('<meta property="og:url" content="' + $url + '">')
  $s = Sub $s '\s*<meta name="robots" content="[^"]*">' ''
  $s = Sub $s '\s*<link rel="canonical" href="[^"]*">' ''
  $s = $s.Replace('<meta property="og:type"', '<link rel="canonical" href="' + $url + '">' + "`n  " + '<meta property="og:type"')
  if ($o.base) {
    $s = $s.Replace('<meta charset="utf-8">', '<meta charset="utf-8">' + "`n  " + '<base href="' + $o.base + '">')
    $s = $s.Replace('<a class="skip" href="#main">', '<a class="skip" href="' + $o.path + '#main">')
  }
  if ($o.ld) { $s = $s.Replace('</head>', '  <script type="application/ld+json">' + $o.ld + '</script>' + "`n</head>") }
  $s = Sub $s '<html lang="en-IN"[^>]*>' $(if ($o.lux) { '<html lang="en-IN" class="lux">' } else { '<html lang="en-IN">' })
  if ($o.main) { $s = Sub $s '(?s)<main id="main">.*?</main>' ('<main id="main">' + "`n" + $o.main + "`n  </main>") }
  if ($o.script) { $s = Sub $s '<script type="module" src="[^"]*"></script>' ('<script type="module" src="' + $o.script + '"></script>') }
  $s
}

function Crumbs([object[]]$items) {
  $list = @(); $i = 0
  foreach ($it in $items) { $i++; $e = [ordered]@{ '@type' = 'ListItem'; position = $i; name = $it[0] }; if ($it[1] -ne $null) { $e.item = $Base + $it[1] }; $list += $e }
  [ordered]@{ '@type' = 'BreadcrumbList'; itemListElement = $list }
}
function FaqLd($qa) { [ordered]@{ '@type' = 'FAQPage'; mainEntity = @($qa | ForEach-Object { [ordered]@{ '@type' = 'Question'; name = $_.q; acceptedAnswer = [ordered]@{ '@type' = 'Answer'; text = $_.a } } }) } }
function AnswersHTML([string]$heading, $qa, [string]$extra = '') {
  '<section class="answers" aria-labelledby="qa-h"><p class="label">Quick answers</p><h2 id="qa-h">' + $heading + '</h2><dl class="qa">' +
  (($qa | ForEach-Object { '<div><dt>' + (HE $_.q) + '</dt><dd>' + (HE $_.a) + '</dd></div>' }) -join '') + '</dl>' + $extra + '</section>'
}
function QA([string]$q, [string]$a) { [pscustomobject]@{ q = $q; a = $a } }

# ---------- Perfume pages ----------
$urls = New-Object System.Collections.ArrayList
foreach ($p in $products) {
  $o = Orig $p
  $name = [string]$p.name; $full = Full $p; $notes = @($p.notes | ForEach-Object { [string]$_ })
  $fam = Fam $p
  $tw = if ($twins.ContainsKey($p.id)) { @($twins[$p.id] | Sort-Object { if ($_.planned_price_inr) { [double]$_.planned_price_inr } else { 1e9 } }) } else { @() }
  $qa = @()
  $smell = "$full is $(A $fam) perfume ($(Size $p)). Its main notes are $(AndList $notes)."
  if ($o) { $smell += " It is most often compared to $(Full $o)." }
  $qa += QA "What does $full smell like?" $smell
  $qa += QA "How long does $name last?" ("By our estimate, $($p.longevity) out of 5: $(Lasts $p.longevity) on skin. Heat, skin type and how much you spray all change this.")
  if ($o) {
    $a = "It's the comparison people make most often."
    if ($p.planned_price_inr -and $o.planned_price_inr) {
      $save = [double]$o.planned_price_inr - [double]$p.planned_price_inr
      $a += " $name costs $(Inr $p.planned_price_inr) (planned launch price) against $(Inr $o.planned_price_inr) for $($o.name)"
      if ($save -gt 0) { $a += ", so you keep $(Inr $save)" }
      $a += '.'
    }
    $a += " Longevity, by our estimate: $($p.longevity)/5 against $($o.longevity)/5. It is a different perfume, made by $($p.house.name), not by $($o.house.name)."
    $qa += QA "Is $name like $(Full $o)?" $a
  }
  if ($tw.Count) {
    $names = @($tw | ForEach-Object { (Full $_) + $(if ($_.planned_price_inr) { ' (' + (Inr $_.planned_price_inr) + ')' } else { '' }) })
    $a = "Yes. On our shelf, $(AndList $names) $(if ($tw.Count -gt 1) { 'are the perfumes' } else { 'is the perfume' }) most often compared to it."
    if ($p.planned_price_inr) { $a += " $name itself is $(Inr $p.planned_price_inr)." }
    $qa += QA "Is there a cheaper alternative to $full?" $a
  }
  if ($p.planned_price_inr) { $qa += QA "How much is $full in India?" "The planned launch price at The Scent Shelf is $(Inr $p.planned_price_inr) (about $(Usd $p.planned_price_inr)). Nothing is on sale yet: you can reserve it now and pay when we launch." }
  else { $qa += QA "How much is $full in India?" 'The price will be announced at launch. You can reserve it now and pay when we launch.' }
  $qa += QA "Who is $name for?" "$name $($WHO[[string]$p.for]). Anyone can wear it."

  $shelfName = if ($p.lux) { 'Lux' } else { 'Shop' }
  $shelfUrl = if ($p.lux) { 'lux.html' } else { 'shop.html' }
  $twinLine = if ($o) { '<p class="pf-twin">Smells like <a href="' + (PUrl $o) + '">' + (HE (Full $o)) + '</a></p>' } else { '' }
  $price = if ($p.planned_price_inr) { '<div class="price"><span>Planned launch price</span>' + (Money $p.planned_price_inr) + '</div>' } else { '<div class="price"><span>Planned launch price</span><strong class="tba">Announced at launch</strong></div>' }
  $extra = ''
  if ($o -and $twins.ContainsKey($o.id)) { $extra = '<p><a class="btn btn--line" href="smells-like/' + $o.id + '/">Everything that smells like ' + (HE $o.name) + '</a></p>' }
  elseif ($tw.Count) { $extra = '<p><a class="btn btn--line" href="smells-like/' + $p.id + '/">Everything that smells like ' + (HE $name) + '</a></p>' }
  $main =
    '    <div class="wrap" id="perfume-root" data-id="' + $p.id + '"><div class="pf-static">' +
    '<nav class="crumbs label" aria-label="Breadcrumb"><a href="' + $shelfUrl + '">' + $shelfName + '</a> / <a href="house/' + $p.brand + '/">' + (HE $p.house.name) + '</a> / No. ' + $p.no.ToString('000') + '</nav>' +
    '<header class="pf-head"><div class="pf-head__main"><p class="pf-brand">' + (HE $p.house.name) + '</p><h1 class="pf-name">' + (HE $name) + '</h1>' + $twinLine +
    '<p class="pf-sum">' + (HE $FAMILY[$fam]) + ' ' + $DOT + ' ' + (HE (Size $p)) + ' ' + $DOT + ' ' + (HE ($WHO[[string]$p.for].Substring(0, 1).ToUpper() + $WHO[[string]$p.for].Substring(1))) + '</p>' +
    '<p class="card__notes">' + (HE ($notes -join ' ' + $DOT + ' ')) + '</p></div>' +
    '<aside class="pf-buy"><p class="status">Coming soon ' + $DOT + ' Reserve now, pay at launch</p>' + $price + '</aside></header></div></div>' + "`n" +
    '    <div class="wrap">' + (AnswersHTML ('About <span class="it red">' + (HE $name) + '.</span>') $qa $extra) + '</div>'

  $desc = "$full is $(A $fam) perfume with $(AndList $notes)."
  if ($p.planned_price_inr) { $desc += " Planned launch price $(Inr $p.planned_price_inr)." }
  if ($o) { $desc += " Smells like $(Full $o)." }
  $desc += ' Lasts ' + (Lasts $p.longevity) + '. Reserve now, pay at launch.'
  $title = if ($o) { "$full, smells like $(Full $o) $DOT The Scent Shelf" } else { "$full $DOT price in India, notes, longevity $DOT The Scent Shelf" }

  $product = [ordered]@{
    '@type' = 'Product'; name = $full; sku = $p.id; url = $Base + (PUrl $p)
    brand = [ordered]@{ '@type' = 'Brand'; name = $p.house.name }
    category = 'Perfume'; description = $smell
    additionalProperty = @(
      [ordered]@{ '@type' = 'PropertyValue'; name = 'Size'; value = "$($p.size_ml) ml" },
      [ordered]@{ '@type' = 'PropertyValue'; name = 'Concentration'; value = [string]$p.concentration },
      [ordered]@{ '@type' = 'PropertyValue'; name = 'Main notes'; value = ($notes -join ', ') },
      [ordered]@{ '@type' = 'PropertyValue'; name = 'Longevity (our estimate, out of 5)'; value = [int]$p.longevity }
    )
  }
  if ($o) { $product.isSimilarTo = [ordered]@{ '@type' = 'Product'; name = (Full $o); url = $Base + (PUrl $o) } }
  if ($p.planned_price_inr) { $product.offers = [ordered]@{ '@type' = 'Offer'; price = [int]$p.planned_price_inr; priceCurrency = 'INR'; availability = 'https://schema.org/PreOrder'; url = $Base + (PUrl $p); seller = $org } }
  $ld = Json ([ordered]@{ '@context' = 'https://schema.org'; '@graph' = @($product, (Crumbs @(@('Home', ''), @($shelfName, $shelfUrl), @($p.house.name, "house/$($p.brand)/"), @($name, $null))), (FaqLd $qa)) })

  Save ("perfume\" + $p.id + "\index.html") (Shell $tplPerfume @{ path = (PUrl $p); base = '../../'; title = $title; desc = $desc; ld = $ld; lux = $p.lux; main = $main })
  [void]$urls.Add((PUrl $p))
}

# ---------- House pages ----------
$houseUrls = @()
foreach ($b in $data.brands) {
  $list = @($products | Where-Object { $_.brand -eq $b.id })
  if (-not $list.Count) { continue }
  $lux = $b.group -ne 'Arabic'
  $priced = @($list | Where-Object { $_.planned_price_inr } | ForEach-Object { [double]$_.planned_price_inr })
  $from = if ($priced.Count) { ($priced | Measure-Object -Minimum).Minimum } else { $null }
  $k = @($list | Where-Object { Orig $_ }).Count
  $intro = "$($list.Count) $($b.name) perfume$(if ($list.Count -ne 1) { 's' })$(if ($from) { ', from ' + (Inr $from) })."
  if ($k) { $intro += " $k of them are compared to well-known designer bottles." }
  $intro += ' Prices are planned launch prices in rupees, with dollars for reference. Nothing is on sale yet: reserve now, pay at launch.'
  $items = ($list | ForEach-Object { '<li><a href="' + (PUrl $_) + '">' + (HE $_.name) + '</a><span>' + $(if ($_.planned_price_inr) { Inr $_.planned_price_inr } else { 'At launch' }) + '</span></li>' }) -join ''
  $tpl = if ($lux) { $tplLux } else { $tplShop }
  $s = Shell $tpl @{
    path = "house/$($b.id)/"; base = '../../'; lux = $lux
    title = "$($b.name) perfumes $DOT prices in India $DOT The Scent Shelf"
    desc = "$($b.name) perfumes at The Scent Shelf: " + $intro
    ld = (Json ([ordered]@{ '@context' = 'https://schema.org'; '@graph' = @(
      [ordered]@{ '@type' = 'CollectionPage'; name = "$($b.name) perfumes"; url = "${Base}house/$($b.id)/"; mainEntity = [ordered]@{ '@type' = 'ItemList'; numberOfItems = $list.Count; itemListElement = @($list | ForEach-Object -Begin { $j = 0 } -Process { $j++; [ordered]@{ '@type' = 'ListItem'; position = $j; url = $Base + (PUrl $_); name = (Full $_) } }) } },
      (Crumbs @(@('Home', ''), @($(if ($lux) { 'Lux' } else { 'Shop' }), $(if ($lux) { 'lux.html' } else { 'shop.html' })), @($b.name, $null)))) }))
  }
  $s = Sub $s '(?s)<header class="page-head">.*?</header>' ('<header class="page-head"><p class="label">' + $(if ($lux) { 'Lux' } else { 'The shelf' }) + ' ' + $DOT + ' House</p><h1>' + (HE $b.name) + ' <span class="it red">perfumes.</span></h1><p>' + (HE $intro) + '</p></header>')
  $s = Sub $s '(?s)<div id="shop-root">.*?</noscript></div>' ('<div id="shop-root"><ul class="seo-list">' + $items + '</ul></div>')
  $s = Sub $s '<body data-tier="(\w+)">' ('<body data-tier="' + $(if ($lux) { 'lux' } else { 'shelf' }) + '" data-brand="' + $b.id + '">')
  Save "house\$($b.id)\index.html" $s
  $houseUrls += "house/$($b.id)/"
}

# ---------- Smells-like pages ----------
function SwapSide($x, [bool]$them, $ref) {
  $bars = '<span class="swap__bars">'
  if ($x.planned_price_inr -and $ref) { $bars += '<span>Price</span>' + (Bar ([double]$x.planned_price_inr / [double]$ref)) }
  $bars += '<span>Lasts</span>' + (Bar ([double]$x.longevity / 5)) + '</span>'
  '<div class="swap__side swap__side--' + $(if ($them) { 'them' } else { 'us' }) + '"><span class="label">' + $(if ($them) { 'Instead of' } else { 'Try' }) + '</span><strong>' + (HE $x.name) + '</strong><em>' + (HE $x.house.name) + '</em>' +
  $(if ($x.planned_price_inr) { Money $x.planned_price_inr } else { '<strong class="tba">At launch</strong>' }) + $bars + '</div>'
}
$slUrls = @()
$hub = @()
foreach ($oid in ($twins.Keys | Sort-Object)) {
  $o = $byId[$oid]
  $tw = @($twins[$oid] | Sort-Object { if ($_.planned_price_inr) { [double]$_.planned_price_inr } else { 1e9 } })
  $cheapest = $tw | Where-Object { $_.planned_price_inr } | Select-Object -First 1
  $cards = ($tw | ForEach-Object {
    $save = if ($_.planned_price_inr -and $o.planned_price_inr) { [double]$o.planned_price_inr - [double]$_.planned_price_inr } else { 0 }
    '<a class="swap" href="' + (PUrl $_) + '">' + (SwapSide $o $true $o.planned_price_inr) + '<div class="swap__arrow" aria-hidden="true">&rarr;</div>' + (SwapSide $_ $false $o.planned_price_inr) +
    $(if ($save -gt 0) { '<div class="swap__save">You keep <span data-countup="' + [int]$save + '" data-fmt="inr">' + (Inr $save) + '</span></div>' } else { '' }) + '</a>'
  }) -join ''
  $names = @($tw | ForEach-Object { (Full $_) + $(if ($_.planned_price_inr) { ' at ' + (Inr $_.planned_price_inr) } else { '' }) })
  $qa = @()
  $qa += QA "What smells like $(Full $o)?" ("On our shelf: $(AndList $names). $(if ($tw.Count -gt 1) { 'These are' } else { 'This is' }) the comparison people make most often. Each is a different perfume, made by a different house.")
  if ($cheapest -and $o.planned_price_inr) { $qa += QA "What is the cheapest alternative to $(Full $o)?" ("$(Full $cheapest), at a planned launch price of $(Inr $cheapest.planned_price_inr) against $(Inr $o.planned_price_inr) for $($o.name).") }
  $qa += QA "Do they last as long as $($o.name)?" ("By our estimates out of 5: $($o.name) $($o.longevity)/5; " + (($tw | ForEach-Object { "$($_.name) $($_.longevity)/5" }) -join '; ') + '. Skin, heat and how much you spray all make a difference.')
  $intro = "$($tw.Count) perfume$(if ($tw.Count -ne 1) { 's' }) on our shelf $(if ($tw.Count -ne 1) { 'are' } else { 'is' }) most often compared to $(Full $o)."
  if ($cheapest -and $o.planned_price_inr) { $intro += " $($o.name) has a planned price of $(Inr $o.planned_price_inr); the closest match here starts at $(Inr $cheapest.planned_price_inr)." }
  $main =
    '    <div class="wrap">' +
    '<nav class="crumbs label" aria-label="Breadcrumb"><a href="./">Home</a> / <a href="smells-like/">Smells like</a> / ' + (HE (Full $o)) + '</nav>' +
    '<header class="page-head"><p class="label">Smells like</p><h1>Smells like ' + (HE (Full $o)) + ', <span class="it red">for less.</span></h1><p class="sl-intro">' + (HE $intro) + ' <a href="' + (PUrl $o) + '">See ' + (HE $o.name) + '</a>.</p></header>' +
    '<div class="swaps">' + $cards + '</div>' +
    '<p class="fineprint">"Smells like" is the comparison people make most often. These are different perfumes, not made by or connected to ' + (HE $o.house.name) + '. Longevity is our estimate. Prices are planned launch prices.</p>' +
    (AnswersHTML ('Smells like <span class="it red">' + (HE $o.name) + '.</span>') $qa) + '</div>'
  $ld = Json ([ordered]@{ '@context' = 'https://schema.org'; '@graph' = @(
    [ordered]@{ '@type' = 'ItemList'; name = "Perfumes that smell like $(Full $o)"; itemListElement = @($tw | ForEach-Object -Begin { $j = 0 } -Process { $j++; [ordered]@{ '@type' = 'ListItem'; position = $j; url = $Base + (PUrl $_); name = (Full $_) } }) },
    (Crumbs @(@('Home', ''), @('Smells like', 'smells-like/'), @((Full $o), $null))), (FaqLd $qa)) })
  Save "smells-like\$oid\index.html" (Shell $tplPerfume @{
    path = "smells-like/$oid/"; base = '../../'; ld = $ld; main = $main; script = './js/app.js'
    title = "Smells like $(Full $o), for less $DOT The Scent Shelf"
    desc = "Affordable perfumes that smell like $(Full $o): " + (AndList $names) + '. Prices and longevity side by side.'
  })
  $slUrls += "smells-like/$oid/"
  $hub += '<li><a href="smells-like/' + $oid + '/">' + (HE (Full $o)) + '</a><span>' + $tw.Count + ' match' + $(if ($tw.Count -ne 1) { 'es' }) + '</span></li>'
}
Save 'smells-like\index.html' (Shell $tplPerfume @{
  path = 'smells-like/'; base = '../'; script = './js/app.js'
  title = "Smells like: affordable alternatives to designer perfumes $DOT The Scent Shelf"
  desc = 'Every designer perfume on our list, with the affordable Arabic perfumes most often compared to it. Prices and longevity side by side.'
  ld = (Json ([ordered]@{ '@context' = 'https://schema.org'; '@graph' = @((Crumbs @(@('Home', ''), @('Smells like', $null)))) }))
  main = '    <div class="wrap"><header class="page-head"><p class="label">Smells like</p><h1>The designer bottle, <span class="it red">for less.</span></h1><p class="sl-intro">Pick a designer perfume to see the affordable perfumes on our shelf that are most often compared to it, with prices and longevity side by side.</p></header><ul class="seo-list">' + ($hub -join '') + '</ul></div>'
})

# ---------- FAQ ----------
$faq = @(
  (QA 'What is The Scent Shelf?' 'An online perfume shop for India, opening soon. Most of the shelf is affordable perfume from Arabic houses such as Lattafa, Afnan, Rasasi and Armaf, including perfumes that smell like well-known designer bottles. Designer and niche perfumes are on a separate shelf called Lux.'),
  (QA 'Is anything on sale yet?' "Not yet. Every perfume is marked 'Coming soon'. You can join the waitlist or reserve bottles now, and nothing is charged until we launch and confirm your order."),
  (QA 'What does "smells like" mean?' 'It names the designer perfume a bottle is most often compared to. The two are different perfumes made by different houses. We are not connected to, or endorsed by, the designer brands.'),
  (QA 'Are the perfumes genuine?' 'We only list genuine bottles from the houses named on them. If a bottle you receive is damaged, wrong or not genuine, you can claim a replacement or refund under our refund policy.'),
  (QA 'How does buy 5, get 1 free work?' 'Put six bottles in your bag and the cheapest one is free. Delivery on that order is free too. Every sixth bottle in an order is free.'),
  (QA 'How much is delivery?' 'A flat delivery fee is shown in your bag before you reserve. It is free on any order that includes a free bottle.'),
  (QA 'Can I return a perfume?' 'All sales are final once paid, except for damaged, wrong or non-genuine items, which you can claim within the window set out in our refund policy.'),
  (QA 'How long do these perfumes last?' 'Each perfume page shows our longevity estimate out of 5. Many Arabic perfumes are known for lasting a long time, but heat, skin and how much you spray all make a difference.'),
  (QA 'Why are prices in rupees and dollars?' "You pay in rupees. Dollars are shown for reference, at about $R$([int]$rate) to the dollar."),
  (QA 'What happens to my details?' 'We use them only for your reservation and launch updates. We never sell them, and we delete them when you ask. Details are in our privacy notice.'),
  (QA 'What is founder hand-delivery?' 'An optional extra at checkout: the founder brings your order to your door personally. It costs $4,000 and is never selected for you.')
)
Save 'faq.html' (Shell $tplPerfume @{
  path = 'faq.html'; script = './js/app.js'
  title = "Questions and answers $DOT The Scent Shelf"
  desc = 'How The Scent Shelf works: reserving, buy 5 get 1 free, delivery, refunds, what "smells like" means and what happens to your details.'
  ld = (Json ([ordered]@{ '@context' = 'https://schema.org'; '@graph' = @((FaqLd $faq), (Crumbs @(@('Home', ''), @('FAQ', $null)))) }))
  main = '    <div class="wrap"><header class="page-head"><p class="label">FAQ</p><h1>Questions, <span class="it red">answered.</span></h1><p>Still stuck? <a href="./contact.html">Contact us</a>.</p></header>' + (AnswersHTML 'Before you <span class="it red">reserve.</span>' $faq) + '</div>'
})

# ---------- Home page structured data ----------
$homeLd = Json ([ordered]@{ '@context' = 'https://schema.org'; '@graph' = @(
  [ordered]@{ '@type' = 'Organization'; '@id' = $Base + '#org'; name = 'The Scent Shelf'; url = $Base; logo = $Base + 'og.png'; description = 'Online perfume shop for India, opening soon: affordable Arabic perfumes, including ones that smell like designer bottles.' },
  [ordered]@{ '@type' = 'WebSite'; '@id' = $Base + '#site'; url = $Base; name = 'The Scent Shelf'; inLanguage = 'en-IN'; publisher = $org
    potentialAction = [ordered]@{ '@type' = 'SearchAction'; target = [ordered]@{ '@type' = 'EntryPoint'; urlTemplate = $Base + 'shop.html?q={search_term_string}' }; 'query-input' = 'required name=search_term_string' } }) })
$ip = Join-Path $root 'index.html'
$ih = [IO.File]::ReadAllText($ip)
$ih = Sub $ih '\s*<script type="application/ld\+json">.*?</script>' ''
$ih = $ih.Replace('</head>', '  <script type="application/ld+json">' + $homeLd + '</script>' + "`n</head>")
[IO.File]::WriteAllText($ip, $ih, $utf8)

# ---------- Keep the hand-written pages on the same base address ----------
if ($ih -match '<link rel="canonical" href="([^"]+)">') {
  $old = $Matches[1]
  if ($old -ne $Base) {
    Get-ChildItem $root -Filter *.html | ForEach-Object { $t = [IO.File]::ReadAllText($_.FullName); [IO.File]::WriteAllText($_.FullName, $t.Replace($old, $Base), $utf8) }
  }
}

# ---------- sitemap.xml, robots.txt, llms.txt ----------
$pages = @('', 'shop.html', 'lux.html', 'find.html', 'faq.html', 'smells-like/', 'privacy.html', 'terms.html', 'refunds.html', 'shipping.html', 'contact.html') + $houseUrls + $slUrls + @($urls)
$sb = New-Object Text.StringBuilder
[void]$sb.AppendLine('<?xml version="1.0" encoding="UTF-8"?>')
[void]$sb.AppendLine('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
foreach ($u in $pages) { [void]$sb.AppendLine("  <url><loc>$Base$u</loc><lastmod>$today</lastmod></url>") }
[void]$sb.AppendLine('</urlset>')
Save 'sitemap.xml' $sb.ToString()

$path = ([Uri]$Base).AbsolutePath
Save 'robots.txt' ("# The Scent Shelf. Search engines and AI assistants are welcome.`nUser-agent: *`nAllow: /`nDisallow: ${path}bag.html`nDisallow: ${path}account.html`n`nSitemap: ${Base}sitemap.xml`n")

$shelfHouses = @($data.brands | Where-Object { $_.group -eq 'Arabic' })
$llm = New-Object Text.StringBuilder
[void]$llm.AppendLine('# The Scent Shelf'); [void]$llm.AppendLine()
[void]$llm.AppendLine('> Online perfume shop for India, opening soon. Affordable perfumes from Arabic houses (' + (($shelfHouses | ForEach-Object { $_.name }) -join ', ') + "), including ones commonly compared to designer bottles, with planned launch prices in rupees. Designer and niche perfumes are on a separate shelf called Lux. Nothing is on sale yet: customers reserve now and pay at launch.")
[void]$llm.AppendLine()
[void]$llm.AppendLine('Scent families, notes and longevity on this site are The Scent Shelf''s own estimates. "Smells like" names the designer perfume a bottle is most often compared to; the products are different and the designer brands are not affiliated. Prices are planned launch prices and may change.')
[void]$llm.AppendLine(); [void]$llm.AppendLine('## Main pages')
[void]$llm.AppendLine("- [Shop the shelf](${Base}shop.html): affordable Arabic perfumes, searchable by note, family and house")
[void]$llm.AppendLine("- [Lux](${Base}lux.html): designer and niche perfumes")
[void]$llm.AppendLine("- [Smells like](${Base}smells-like/): affordable alternatives to designer perfumes, side by side")
[void]$llm.AppendLine("- [Scent Finder](${Base}find.html): a shortlist from a description, notes, budget or a designer perfume you like")
[void]$llm.AppendLine("- [FAQ](${Base}faq.html): reserving, buy 5 get 1 free, delivery, refunds")
[void]$llm.AppendLine(); [void]$llm.AppendLine('## Houses')
foreach ($b in $data.brands) { $c = @($products | Where-Object { $_.brand -eq $b.id }).Count; if ($c) { [void]$llm.AppendLine("- [$($b.name)](${Base}house/$($b.id)/): $c perfumes$(if ($b.group -ne 'Arabic') { ' (Lux)' })") } }
[void]$llm.AppendLine(); [void]$llm.AppendLine('## Smells like')
foreach ($oid in ($twins.Keys | Sort-Object)) { $o = $byId[$oid]; [void]$llm.AppendLine("- [Perfumes that smell like $(Full $o)](${Base}smells-like/$oid/)") }
[void]$llm.AppendLine(); [void]$llm.AppendLine('## Optional')
[void]$llm.AppendLine("- [Sitemap](${Base}sitemap.xml): every perfume page")
[void]$llm.AppendLine("- [Catalogue data](${Base}data/products.json): every product as JSON")
Save 'llms.txt' $llm.ToString()

Write-Host ("Done: {0} perfume pages, {1} house pages, {2} smells-like pages, faq, sitemap ({3} URLs), robots.txt, llms.txt" -f $urls.Count, $houseUrls.Count, $slUrls.Count, $pages.Count)
