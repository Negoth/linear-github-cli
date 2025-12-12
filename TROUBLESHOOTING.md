# Troubleshooting Guide

## GitHub認証エラー: プロジェクトスコープ不足

### エラーメッセージ
```
❌ GitHub認証エラー: プロジェクトを取得するために必要なスコープがありません
   必要なスコープ: read:project
```

### 解決方法

#### 方法1: 認証を更新（推奨）

```bash
gh auth refresh -s read:project
```

これにより、GitHub CLIの認証トークンに`read:project`スコープが追加されます。

#### 方法2: プロジェクト選択をスキップ

エラーが表示されても、プロジェクト選択をスキップして続行できます。Issue作成自体には影響しません。

### 確認方法

認証が正しく更新されたか確認：

```bash
gh auth status
```

出力に`read:project`スコープが含まれていることを確認してください。

## Linear API エラー

### エラーメッセージ
```
❌ Error updating Linear issue: ...
```

### 解決方法

1. **APIキーを確認**
   ```bash
   echo $LINEAR_API_KEY
   ```

2. **Linear設定でAPIキーを再生成**
   - [Linear Settings > API](https://linear.app/settings/api)にアクセス
   - 新しいPersonal API Keyを生成
   - 環境変数を更新

3. **手動でメタデータを更新**
   - Linear UIで直接issueを開く
   - Due dateとProjectを手動で設定

## その他の問題

### Issue作成は成功するが、Linear同期が失敗する

- Linear GitHub Integrationが有効になっているか確認
- 10秒の待機時間を延長する（コード内の`setTimeout`を調整）
- GitHub Actionsワークフローが正しく設定されているか確認

### リポジトリリストが空

```bash
# GitHub CLIの認証状態を確認
gh auth status

# 再認証
gh auth login
```

