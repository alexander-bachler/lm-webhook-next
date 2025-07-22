'use client';

import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Code } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Decoder {
  id: string;
  name: string;
  description: string;
  manufacturer: string;
  model: string;
  image?: string;
  repository: string;
}

interface DecoderSelectProps {
  decoders: Decoder[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function DecoderSelect({ decoders, value, onValueChange, placeholder = "Decoder auswählen..." }: DecoderSelectProps) {
  const [open, setOpen] = useState(false);

  // Sortiere Decoder: Eingebaute zuerst, dann alphabetisch
  const sortedDecoders = useMemo(() => {
    return [...decoders].sort((a, b) => {
      // Eingebaute Decoder zuerst
      if (a.repository === 'builtin' && b.repository !== 'builtin') return -1;
      if (a.repository !== 'builtin' && b.repository === 'builtin') return 1;
      
      // Dann nach Name sortieren
      return a.name.localeCompare(b.name);
    });
  }, [decoders]);

  // Gruppiere Decoder nach Repository
  const groupedDecoders = useMemo(() => {
    const groups: Record<string, Decoder[]> = {};
    
    sortedDecoders.forEach(decoder => {
      const group = decoder.repository === 'builtin' ? 'Eingebaute Decoder' : 
                   decoder.repository === 'os2iot' ? 'OS2iot Repository' :
                   decoder.repository === 'ttn-official' ? 'TTN Official Repository' :
                   decoder.repository === 'rakwireless' ? 'RAKwireless Repository' :
                   decoder.repository === 'ttn-community' ? 'TTN Community Repository' :
                   `${decoder.repository} Repository`;
      
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(decoder);
    });
    
    return groups;
  }, [sortedDecoders]);

  const selectedDecoder = decoders.find(decoder => decoder.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedDecoder ? (
            <div className="flex items-center gap-2 truncate">
              <Code className="h-4 w-4 shrink-0" />
              <div className="truncate text-left">
                <div className="font-medium truncate">{selectedDecoder.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {selectedDecoder.manufacturer} {selectedDecoder.model}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Decoder suchen..." />
          <CommandList>
            <CommandEmpty>Kein Decoder gefunden.</CommandEmpty>
            {Object.entries(groupedDecoders).map(([groupName, groupDecoders]) => (
              <CommandGroup key={groupName} heading={groupName}>
                {groupDecoders.map((decoder) => (
                  <CommandItem
                    key={decoder.id}
                    value={`${decoder.name} ${decoder.manufacturer} ${decoder.model} ${decoder.description}`}
                    onSelect={() => {
                      onValueChange(decoder.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === decoder.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Code className="h-4 w-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{decoder.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {decoder.manufacturer} {decoder.model}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {decoder.description}
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
} 