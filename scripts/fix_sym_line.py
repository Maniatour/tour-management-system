path = "src/app/[locale]/admin/reservations/page.tsx"


def main() -> None:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    fixes = {
        1484: "              console.log('reservation.selectedChoices에서 초이스 데이터 발견:', selectedChoices.length, '개')\n",
        1505: "            console.log('reservation.choices.required에서 초이스 데이터 발견:', reservation.choices.required.length, '개')\n",
        1519: "          console.log('저장할 초이스 데이터', choicesToSave.length, '개', choicesToSave)\n",
        1541: "              console.log('초이스 저장 성공:', choicesToSave.length, '개', insertedChoices)\n",
        2049: "    if (lang === 'kr' || lang === 'ko' || lang === '한국어') return 'KR'\n",
        2050: "    if (lang === 'en' || lang === '영어') return 'US'\n",
        2051: "    if (lang === 'jp' || lang === '일본어') return 'JP'\n",
        2052: "    if (lang === 'cn' || lang === '중국어') return 'CN'\n",
        2886: '              <h2 className="text-xl font-semibold text-gray-900">후기 관리</h2>\n',
    }
    for idx, new_line in fixes.items():
        if idx < 0 or idx >= len(lines):
            raise SystemExit(f"bad line index {idx}")
        lines[idx] = new_line

    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.writelines(lines)
    print("OK")


if __name__ == "__main__":
    main()
