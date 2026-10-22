![Docker CI](https://github.com/Iris408/accesshub/actions/workflows/docker-ci.yml/badge.svg)
![Frontend CI](https://github.com/Iris408/accesshub/actions/workflows/frontend-ci.yml/badge.svg)

# AccessHub

[日本語](#日本語)

AccessHub is a React and TypeScript authentication frontend connected to a deployed FastAPI backend.

## Live Demo

Frontend:

- [AccessHub](https://accesshub-iris408.vercel.app)

Backend API:

- [Secure User API Swagger Docs](https://mini-user-api.onrender.com/docs)

Related backend repository:

- [Secure User API](https://github.com/Iris408/secure-user-api)

## Current Status

## Current Status

| Area | Status | Area | Status |
| --- | --- | --- | --- |
| React / TypeScript frontend | ✅ Complete | Vercel deployment | ✅ Live |
| Login and JWT session | ✅ Working | Render API integration | ✅ Live |
| Protected dashboard | ✅ Working | Frontend CI | ✅ Passing |
| User and role management | ✅ Working | Docker CI | ✅ Passing |
| Access requests | ✅ Working | Activity feed and audit log | ✅ Working |
| Organisation settings | ✅ Working | Loading, errors and responsive UI | ✅ Complete |

## Features

- **Authentication:** JWT sign-in, protected routes, and API-enforced access for four roles.
- **User administration:** Create, update, deactivate, reactivate, or delete users; issue temporary passwords.
- **Access requests:** Submit, review, approve, or decline role-change requests with decision history.
- **Role and organisation settings:** Configure permitted role access, organisation name, timezone, request policy, and session length.
- **Activity and audit:** Filterable organisation activity feed and a read-only, Admin-only audit log.
- **Interface:** Responsive dashboard with light and dark themes and six languages.

## Maintenance Backlog

- Add a guarded, operator-run reset for the hosted demo. It should restore demo-owned users, sample access requests, role permissions and organisation settings to their defaults; refuse production or an unexpected database; and preserve the append-only audit history.

## Screenshots

### Sign-in

| Desktop | Mobile |
| --- | --- |
| <img src="./screenshots/login-desktop.png" alt="AccessHub desktop sign-in page" width="700"/> | <img src="./screenshots/login-mobile.png" alt="AccessHub mobile sign-in page" width="300"/> |

### Admin dashboard

| Light theme | Dark theme |
| --- | --- |
| <img src="./screenshots/dashboard-light.png" alt="AccessHub admin dashboard in light theme" width="700"/> | <img src="./screenshots/dashboard-dark.png" alt="AccessHub admin dashboard in dark theme" width="700"/> |

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router, CSS |
| Backend API | FastAPI, PostgreSQL, SQLAlchemy, JWT authentication |
| Deployment | Vercel, Render |
| DevOps / Tooling | Docker, GitHub Actions, Git, GitHub |

## Quick Start

Clone the repository:

```bash
git clone https://github.com/Iris408/accesshub
cd accesshub
```

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
VITE_API_URL=https://mini-user-api.onrender.com
VITE_DEMO_API_URL=https://accesshub-demo-api.onrender.com
```

Run locally:

```bash
npm run dev
```

Build check:

```bash
npm run build
```

## Documentation

More detailed project documentation is available in the `docs/` folder.

| Document | Description |
| --- | --- |
| [Setup Guide](./docs/setup.md) | Local setup, environment variables, build commands, and the isolated public demo |
| [Auth Flow](./docs/auth-flow.md) | JWT login, token storage, protected routes, and admin-only access |
| [Frontend Notes](./docs/frontend-notes.md) | Pages, UI behaviour, routing, loading states, and frontend improvements |
| [Project Details](./docs/project-details.md) | Architecture, related backend, limitations, future improvements, and learning notes |
| [CI Notes](./docs/ci.md) | Frontend CI and Docker CI workflow notes |

## Project Summary

AccessHub is a React and TypeScript authentication frontend demonstrating a complete JWT-based authentication and authorisation flow. It integrates with Secure User API to provide protected routing, role-based access, admin-only functionality, authenticated API requests, and production-style deployment using Vercel, Render, Docker, and GitHub Actions CI.

## Author

Built by Iris408

---

## 日本語

[English](#accesshub)

AccessHubは、ReactとTypeScriptで構築され、デプロイ済みのFastAPIバックエンドに接続する認証フロントエンドです。

## ライブデモ

フロントエンド：

- [AccessHub](https://accesshub-iris408.vercel.app)

バックエンドAPI：

- [Secure User API Swagger Docs](https://mini-user-api.onrender.com/docs)

関連するバックエンドリポジトリ：

- [Secure User API](https://github.com/Iris408/secure-user-api)

## 現在の状態

## 現在の状態

| 項目 | 状態 | 項目 | 状態 |
| --- | --- | --- | --- |
| React / TypeScriptフロントエンド | ✅ 完成 | Vercelへのデプロイ | ✅ 稼働中 |
| ログイン・JWTセッション | ✅ 動作中 | Render API連携 | ✅ 稼働中 |
| 保護されたダッシュボード | ✅ 動作中 | フロントエンドCI | ✅ 成功 |
| ユーザー・ロール管理 | ✅ 動作中 | Docker CI | ✅ 成功 |
| アクセス申請 | ✅ 動作中 | アクティビティ・監査ログ | ✅ 動作中 |
| 組織設定 | ✅ 動作中 | 読み込み・エラー処理・レスポンシブ対応 | ✅ 完了 |

## 主な機能

 **認証：** JWTサインイン、保護されたルート、APIで検証される4種類のロール権限。
- **ユーザー管理：** ユーザーの作成、更新、無効化、再有効化、削除、一時パスワードの発行。
- **アクセス申請：** ロール変更の申請、確認、承認、却下と決定履歴。
- **ロール・組織設定：** ロールごとのアクセス権、組織名、タイムゾーン、申請ポリシー、セッション有効期間の設定。
- **アクティビティ・監査：** 絞り込み可能な組織アクティビティと、Admin専用の読み取り専用監査ログ。
- **インターフェース：** レスポンシブ対応、ライト・ダークテーマ、6種類の表示言語。

## メンテナンス項目

- ホストされたデモ環境を、運用者が安全に手動で初期状態へ戻せる機能を追加する予定です。デモ用ユーザー、サンプルのアクセス申請、ロール権限、組織設定を初期値に戻します。本番環境や想定外のデータベースでは処理を拒否し、追記専用の監査履歴は保持します。

## スクリーンショット

### サインイン画面

| デスクトップ | モバイル |
| --- | --- |
| <img src="./screenshots/login-desktop.png" alt="AccessHubのデスクトップ版サインイン画面" width="700"/> | <img src="./screenshots/login-mobile.png" alt="AccessHubのモバイル版サインイン画面" width="300"/> |

### 管理者ダッシュボード

| ライトテーマ | ダークテーマ |
| --- | --- |
| <img src="./screenshots/dashboard-light.png" alt="ライトテーマのAccessHub管理者ダッシュボード" width="700"/> | <img src="./screenshots/dashboard-dark.png" alt="ダークテーマのAccessHub管理者ダッシュボード" width="700"/> |

## 技術スタック

| 分野 | 技術 |
| --- | --- |
| フロントエンド | React、TypeScript、Vite、React Router、CSS |
| バックエンドAPI | FastAPI、PostgreSQL、SQLAlchemy、JWT認証 |
| デプロイ | Vercel、Render |
| DevOps・開発ツール | Docker、GitHub Actions、Git、GitHub |

## クイックスタート

リポジトリをクローンします。

```bash
git clone https://github.com/Iris408/accesshub
cd accesshub
```

依存関係をインストールします。

```bash
npm install
```

`.env`ファイルを作成します。

```env
VITE_API_URL=https://mini-user-api.onrender.com
VITE_DEMO_API_URL=https://accesshub-demo-api.onrender.com
```

ローカル開発サーバーを起動します。

```bash
npm run dev
```

本番用ビルドを確認します。

```bash
npm run build
```

## ドキュメント

詳しいプロジェクト情報は`docs/`フォルダーにあります。

| ドキュメント | 内容 |
| --- | --- |
| [セットアップガイド](./docs/setup.md) | ローカル環境、環境変数、ビルド方法、独立した公開デモ |
| [認証フロー](./docs/auth-flow.md) | JWTログイン、トークン保存、保護されたルート、Admin専用アクセス |
| [フロントエンドノート](./docs/frontend-notes.md) | ページ、画面の動作、ルーティング、読み込み状態、改善点 |
| [プロジェクト詳細](./docs/project-details.md) | アーキテクチャ、関連バックエンド、制限事項、今後の改善、学習メモ |
| [CIノート](./docs/ci.md) | フロントエンドCIとDocker CIの説明 |

## プロジェクト概要

AccessHubは、JWT認証と認可の一連の流れを示すReact・TypeScript製のフロントエンドです。Secure User APIと連携し、保護されたルート、ロールベースのアクセス制御、Admin専用機能、認証済みAPIリクエストを提供します。Vercel、Render、Docker、GitHub Actions CIを使ってデプロイ・検証しています。

## 作成者

Iris408
