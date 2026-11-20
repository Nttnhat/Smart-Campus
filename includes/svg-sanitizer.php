<?php
// Làm sạch sơ đồ tầng SVG do admin tải lên trước khi lưu vào database.
// Cách làm: whitelist - chỉ giữ thẻ/thuộc tính vẽ hình cơ bản, mọi thứ khác bị xoá.
// Không nạp DTD/entity ngoài (chống XXE). Sơ đồ vẫn được hiển thị qua <img>, đây là lớp bảo vệ thứ 2.
const SVG_ALLOWED_TAGS = ['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'title', 'desc'];
const SVG_ALLOWED_ATTRS = [
    'id', 'class', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'points',
    'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap',
    'stroke-linejoin', 'opacity', 'transform', 'viewbox', 'preserveaspectratio', 'font-size', 'font-family', 'font-weight',
    'text-anchor', 'dominant-baseline', 'dx', 'dy', 'xmlns', 'version', 'data-room',
];

function sanitize_svg(string $input): ?string
{
    $input = trim($input);
    if ($input === '' || strlen($input) > 2_000_000 || stripos($input, '<svg') === false) {
        return null;
    }
    // Bỏ DOCTYPE (nơi khai báo entity) trước khi parse.
    $input = preg_replace('/<!DOCTYPE[^>\[]*(\[[\s\S]*?\])?\s*>/i', '', $input);

    $doc = new DOMDocument();
    $previous = libxml_use_internal_errors(true);
    $ok = $doc->loadXML($input, LIBXML_NONET | LIBXML_NOBLANKS | LIBXML_COMPACT);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);
    if (!$ok || !$doc->documentElement || strtolower($doc->documentElement->localName) !== 'svg') {
        return null;
    }

    sanitize_svg_node($doc->documentElement);
    $root = $doc->documentElement;
    $root->setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // SVG chỉ có viewBox (không width/height) không có kích thước gốc -> trong <img> bị co về gần 0.
    $viewBox = preg_split('/[\s,]+/', trim($root->getAttribute('viewBox')));
    if (count($viewBox) === 4 && (float) $viewBox[2] > 0 && (float) $viewBox[3] > 0) {
        if (!$root->hasAttribute('width')) {
            $root->setAttribute('width', (string) (float) $viewBox[2]);
        }
        if (!$root->hasAttribute('height')) {
            $root->setAttribute('height', (string) (float) $viewBox[3]);
        }
    }
    return $doc->saveXML($root);
}

function sanitize_svg_node(DOMElement $element): void
{
    // Thuộc tính: chỉ giữ whitelist, giá trị không được chứa url(/javascript:/expression.
    foreach (iterator_to_array($element->attributes ?? []) as $attr) {
        $name = strtolower($attr->localName);
        $value = $attr->value;
        $safe = in_array($name, SVG_ALLOWED_ATTRS, true) && $attr->prefix === ''
            && !preg_match('/url\s*\(|javascript:|expression\s*\(|@import/i', $value);
        if (!$safe) {
            $element->removeAttributeNode($attr);
        }
    }
    foreach (iterator_to_array($element->childNodes) as $child) {
        if ($child instanceof DOMElement) {
            if (in_array(strtolower($child->localName), SVG_ALLOWED_TAGS, true) && $child->prefix === '') {
                sanitize_svg_node($child);
            } elseif (strtolower($child->localName) === 'a') {
                // Giữ hình bên trong link, bỏ chính thẻ <a>. Làm sạch nội dung TRƯỚC khi đưa ra ngoài.
                sanitize_svg_node($child);
                while ($child->firstChild) {
                    $element->insertBefore($child->firstChild, $child);
                }
                $element->removeChild($child);
            } else {
                $element->removeChild($child);
            }
        } elseif (!($child instanceof DOMText)) {
            $element->removeChild($child); // comment, CDATA, processing instruction...
        }
    }
}
