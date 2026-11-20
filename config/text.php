<?php
function remove_diacritics(string $s): string
{
    $s = mb_strtolower(trim($s), 'UTF-8');
    $s = strtr($s, ['đ' => 'd']);
    $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
    return $converted === false ? $s : preg_replace('/[^a-z0-9 ]+/', '', $converted);
}
