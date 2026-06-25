import React, { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { sql, StandardSQL } from '@codemirror/lang-sql';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import './SQLEditor.css';

function SQLEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);

  // Keep onChangeRef updated
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Initialize editor once on mount. The initial value is set from the `value` prop.
  // Subsequent value changes are handled by the separate useEffect below (lines 78-90).
  useEffect(() => {
    if (!editorRef.current) return;

    // Create editor state with extensions
    const startState = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap
        ]),
        sql({
          dialect: StandardSQL,
          upperCaseKeywords: true
        }),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            onChangeRef.current(newValue);
          }
        })
      ]
    });

    // Create editor view
    const view = new EditorView({
      state: startState,
      parent: editorRef.current
    });

    viewRef.current = view;

    // Cleanup
    return () => {
      view.destroy();
    };
  }, []); // Only run once on mount

  // Update editor when value changes externally
  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      const transaction = viewRef.current.state.update({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value
        }
      });
      viewRef.current.dispatch(transaction);
    }
  }, [value]); // Update when value changes

  return (
    <div className="sql-editor-wrapper">
      <div ref={editorRef} className="sql-editor-container" />
    </div>
  );
}

export default SQLEditor;
