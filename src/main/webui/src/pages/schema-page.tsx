import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import Editor, { type OnMount } from "@monaco-editor/react"
import type { editor as monacoEditor, IDisposable } from "monaco-editor"
import { ChevronRightIcon, PlayIcon, TableIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ColumnInfo {
  name: string
  type: string
}

interface TableInfo {
  name: string
  columns: ColumnInfo[]
}

type SqlClause = "select" | "from" | "where" | "join" | "orderby" | "groupby" | "other"

/** Determine which SQL clause the cursor is in and which tables are referenced in FROM/JOIN. */
function analyzeSqlContext(text: string): { clause: SqlClause; referencedTables: Set<string> } {
  // Find the nearest preceding keyword to determine clause context
  // We work on the text up to the cursor (already sliced by caller)
  const upper = text.toUpperCase()

  // Walk backwards to find the last major keyword
  const keywords: { kw: string; clause: SqlClause }[] = [
    { kw: "SELECT", clause: "select" },
    { kw: "FROM", clause: "from" },
    { kw: "JOIN", clause: "join" },
    { kw: "WHERE", clause: "where" },
    { kw: "ON", clause: "where" },
    { kw: "AND", clause: "where" },
    { kw: "OR", clause: "where" },
    { kw: "HAVING", clause: "where" },
    { kw: "SET", clause: "select" },
    { kw: "ORDER BY", clause: "orderby" },
    { kw: "GROUP BY", clause: "groupby" },
  ]

  let clause: SqlClause = "other"
  let bestPos = -1
  for (const { kw, clause: c } of keywords) {
    // Match keyword as whole word (preceded by whitespace/start, followed by whitespace/end)
    const re = new RegExp(`(?:^|\\s)${kw.replace(" ", "\\s+")}(?:\\s|$)`, "gi")
    let m: RegExpExecArray | null
    while ((m = re.exec(upper)) !== null) {
      const pos = m.index
      if (pos > bestPos) {
        bestPos = pos
        clause = c
      }
    }
  }

  // Extract referenced tables from the full text (FROM + JOIN clauses)
  const referencedTables = new Set<string>()
  // Match: FROM/JOIN followed by optional whitespace, then either "quoted" or unquoted identifier
  const tableRefRe = /(?:FROM|JOIN)\s+("([^"]+)"|(\w+))/gi
  let tm: RegExpExecArray | null
  while ((tm = tableRefRe.exec(text)) !== null) {
    const tableName = tm[2] ?? tm[3] // group 2 = quoted, group 3 = unquoted
    if (tableName) referencedTables.add(tableName.toLowerCase())
  }

  return { clause, referencedTables }
}

async function fetchTables(schema: string): Promise<TableInfo[]> {
  const res = await fetch(`/api/schemas/${encodeURIComponent(schema)}/tables`)
  if (!res.ok) throw new Error("Failed to fetch tables")
  return res.json()
}

interface QueryResponse {
  columns: string[]
  columnTypes: string[]
  rows: (string | number | boolean | null)[][]
  error: string | null
}

async function executeQuery(sql: string, schema: string): Promise<QueryResponse> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, schema }),
  })
  if (!res.ok) throw new Error("Request failed")
  return res.json()
}

const columnHelper = createColumnHelper<(string | number | boolean | null)[]>()

export function SchemaPage() {
  const { name } = useParams<{ name: string }>()
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const tablesRef = useRef<TableInfo[]>([])
  const [result, setResult] = useState<QueryResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ["tables", name],
    queryFn: () => fetchTables(name!),
    enabled: !!name,
  })

  useEffect(() => {
    tablesRef.current = tables ?? []
  }, [tables])

  const toggleTable = useCallback((tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev)
      if (next.has(tableName)) next.delete(tableName)
      else next.add(tableName)
      return next
    })
  }, [])

  const runQuery = useCallback(async (sql: string) => {
    setRunning(true)
    try {
      const res = await executeQuery(sql, name!)
      setResult(res)
    } catch {
      setResult({ columns: [], rows: [], error: "Failed to execute query" })
    } finally {
      setRunning(false)
    }
  }, [name])

  const handleRun = useCallback(() => {
    const sql = editorRef.current?.getValue()
    if (!sql?.trim()) return
    runQuery(sql)
  }, [runQuery])

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor

    editor.addAction({
      id: "run-query",
      label: "Run Query",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => handleRun(),
    })

    const provider = monaco.languages.registerCompletionItemProvider("sql", {
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        }

        // Get all text up to cursor for clause detection
        const textUntilCursor = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        })
        const fullText = model.getValue()
        const { clause, referencedTables } = analyzeSqlContext(textUntilCursor)
        // Also scan the full text for referenced tables (e.g. cursor is in SELECT but FROM is below)
        const allReferenced = analyzeSqlContext(fullText).referencedTables
        referencedTables.forEach((t) => allReferenced.add(t))

        const suggestions: monacoEditor.ISingleEditOperation[] = []
        for (const t of tablesRef.current) {
          const isReferenced = allReferenced.has(t.name.toLowerCase())

          // Table suggestion — high priority in FROM/JOIN, low elsewhere
          const tablePriority = (clause === "from" || clause === "join") ? "0" : "2"
          suggestions.push({
            label: t.name,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: `"${t.name}"`,
            range,
            detail: "table",
            sortText: `${tablePriority}_${t.name}`,
          } as never)

          // Column suggestions — high priority in SELECT/WHERE/ORDER BY/GROUP BY if table is referenced
          let colPriority: string
          if ((clause === "select" || clause === "where" || clause === "orderby" || clause === "groupby") && isReferenced) {
            colPriority = "0" // top rank: column from a referenced table in a column-expecting clause
          } else if (clause === "select" || clause === "where" || clause === "orderby" || clause === "groupby") {
            colPriority = "1" // mid rank: column clause but table not referenced
          } else {
            colPriority = "2" // low rank: we're in FROM/JOIN/other, columns are unlikely
          }

          for (const col of t.columns) {
            suggestions.push({
              label: col.name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: `"${col.name}"`,
              range,
              detail: `${t.name} (${col.type})`,
              sortText: `${colPriority}_${col.name}`,
            } as never)
          }
        }

        return { suggestions }
      },
    })

    ;(editor as unknown as { _completionProvider: IDisposable })._completionProvider = provider
  }, [handleRun])

  useEffect(() => {
    return () => {
      const editor = editorRef.current as unknown as { _completionProvider?: IDisposable } | null
      editor?._completionProvider?.dispose()
    }
  }, [])

  const columns = useMemo(() => {
    if (!result?.columns.length) return []
    return result.columns.map((col, i) => {
      const type = result.columnTypes[i]
      const isJson = type === "jsonb" || type === "json"
      return columnHelper.accessor((row) => row[i], {
        id: col,
        header: col,
        cell: (info) => {
          const val = info.getValue()
          if (val === null) return <span className="text-muted-foreground italic">null</span>
          if (isJson) {
            try {
              const parsed = typeof val === "string" ? JSON.parse(val) : val
              return <pre className="whitespace-pre-wrap max-w-md">{JSON.stringify(parsed, null, 2)}</pre>
            } catch { /* fall through */ }
          }
          return String(val)
        },
      })
    })
  }, [result?.columns])

  const table = useReactTable({
    data: result?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="h-full flex flex-col">
      <ResizablePanelGroup orientation="vertical" className="flex-1">
        {/* Top: Editor + Tables */}
        <ResizablePanel defaultSize={50} minSize={20}>
          <ResizablePanelGroup orientation="horizontal">
            {/* Editor */}
            <ResizablePanel defaultSize={80} minSize={40}>
              <div className="h-full flex flex-col">
                <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30 shrink-0">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleRun}
                    disabled={running}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <PlayIcon className="size-3" />
                    {running ? "Running..." : "Run"}
                  </Button>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Ctrl+Enter to run
                  </span>
                </div>
                <div className="flex-1">
                  <Editor
                    defaultLanguage="sql"
                    defaultValue={`SELECT * FROM  LIMIT 100;`}
                    theme="vs-dark"
                    onMount={handleEditorMount}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      padding: { top: 8 },
                    }}
                  />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Tables Panel */}
            <ResizablePanel defaultSize={20} minSize={10}>
              <div className="h-full flex flex-col border-l">
                <div className="px-3 py-2 border-b bg-muted/30 shrink-0">
                  <h3 className="text-sm font-medium">{name}</h3>
                </div>
                <div className="flex-1 overflow-auto p-2">
                  {tablesLoading && (
                    <p className="text-muted-foreground text-xs px-2">Loading...</p>
                  )}
                  {tables?.length === 0 && (
                    <p className="text-muted-foreground text-xs px-2">No tables</p>
                  )}
                  {tables?.map((t) => (
                    <div key={t.name}>
                      <div className="flex items-center gap-1 w-full rounded-md px-1 py-1 text-sm hover:bg-accent">
                        <button
                          className="shrink-0 p-0.5 rounded hover:bg-accent-foreground/10"
                          onClick={() => toggleTable(t.name)}
                        >
                          <ChevronRightIcon
                            className={`size-3.5 text-muted-foreground transition-transform ${expandedTables.has(t.name) ? "rotate-90" : ""}`}
                          />
                        </button>
                        <button
                          className="flex items-center gap-2 flex-1 min-w-0 text-left"
                          onClick={() => {
                            const sql = `SELECT * FROM "${t.name}" LIMIT 50;`
                            editorRef.current?.setValue(sql)
                            runQuery(sql)
                          }}
                        >
                          <TableIcon className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{t.name}</span>
                        </button>
                        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 shrink-0">
                          table
                        </Badge>
                      </div>
                      {expandedTables.has(t.name) && (
                        <div className="ml-7 border-l pl-2 py-0.5">
                          {t.columns.map((col) => (
                            <div
                              key={col.name}
                              className="flex items-center gap-2 text-xs py-0.5"
                            >
                              <span className="truncate">{col.name}</span>
                              <span className="text-muted-foreground shrink-0">{col.type}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Bottom: Results */}
        <ResizablePanel defaultSize={50} minSize={15}>
          <div className="h-full overflow-auto border-t">
            {!result && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Run a query to see results
              </div>
            )}
            {result?.error && (
              <div className="p-4 text-destructive text-sm font-mono whitespace-pre-wrap">
                {result.error}
              </div>
            )}
            {result && !result.error && result.columns.length > 0 && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id}>
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="font-mono text-xs">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t px-3 py-1.5 text-xs text-muted-foreground shrink-0">
                  {result.rows.length} row{result.rows.length !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
