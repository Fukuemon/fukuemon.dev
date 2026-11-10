import type { Meta, StoryObj } from "@storybook/react-vite";

import { Table } from "./Table";

const HEADERS = [
  ["content-type", "application/json; charset=utf-8"],
  ["cache-control", "no-store"],
  ["set-cookie", "session=dummy-value; Path=/; HttpOnly; Secure; SameSite=Lax"],
];

const meta = {
  title: "コンポーネント/Base/Table",
  component: Table,
  args: {
    caption: "レスポンスのヘッダ",
    children: (
      <>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>名前</Table.HeaderCell>
            <Table.HeaderCell>値</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {HEADERS.map(([name, value]) => (
            <Table.Row key={name}>
              <Table.HeaderCell scope="row">{name}</Table.HeaderCell>
              <Table.Cell>{value}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </>
    ),
  },
} satisfies Meta<typeof Table>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "デフォルト" };
export const Wide: Story = {
  name: "横に送る",
  args: {
    caption: "SQL の結果",
    children: (
      <>
        <Table.Header>
          <Table.Row>
            {["id", "name", "email", "created_at", "updated_at", "role", "status"].map((c) => (
              <Table.HeaderCell key={c}>{c}</Table.HeaderCell>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {[1, 2].map((id) => (
            <Table.Row key={id}>
              {[
                String(id),
                `user-${id}`,
                `user-${id}@example.com`,
                "2026-01-01 00:00:00",
                "2026-01-02 00:00:00",
                "member",
                "active",
              ].map((v) => (
                <Table.Cell key={v}>{v}</Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </>
    ),
  },
  decorators: [
    (Story) => (
      <div className="max-w-80">
        <Story />
      </div>
    ),
  ],
};
export const Focus: Story = { name: "フォーカス", parameters: { pseudo: { focusVisible: true } } };
